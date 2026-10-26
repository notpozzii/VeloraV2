#!/usr/bin/env python3
"""Prepare or apply bucket-scoped GitHub OIDC access; no website upload occurs here."""
import argparse
import json
import pathlib
import re
import shutil
import subprocess
import sys

CONFIG = pathlib.Path(__file__).with_name('s3-github-config.json')
POLICY_NAME = 'VeloraS3Upload'


def documents(config, account):
    if not re.fullmatch(r'\d{12}', account):
        raise ValueError('AWS account ID must contain 12 digits.')
    provider = f'arn:aws:iam::{account}:oidc-provider/token.actions.githubusercontent.com'
    owner, repo = config['repository'].split('/')
    subject = f"repo:{owner}@{config['owner_id']}/{repo}@{config['repository_id']}:environment:{config['environment']}"
    trust = {'Version': '2012-10-17', 'Statement': [{
        'Effect': 'Allow', 'Principal': {'Federated': provider},
        'Action': 'sts:AssumeRoleWithWebIdentity',
        'Condition': {'StringEquals': {
            'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
            'token.actions.githubusercontent.com:sub': subject,
        }},
    }]}
    bucket = 'arn:aws:s3:::' + config['bucket']
    access = {'Version': '2012-10-17', 'Statement': [
        {'Effect': 'Allow', 'Action': ['s3:GetBucketLocation', 's3:ListBucket'], 'Resource': bucket},
        {'Effect': 'Allow', 'Action': ['s3:GetObject', 's3:PutObject', 's3:AbortMultipartUpload', 's3:ListMultipartUploadParts'], 'Resource': bucket + '/*'},
    ]}
    return trust, access


class AwsError(RuntimeError):
    pass


def aws(*args, optional=False):
    result = subprocess.run(['aws', *args, '--no-cli-pager', '--output', 'json'], capture_output=True, text=True)
    if result.returncode:
        if optional and 'NoSuchEntity' in result.stderr:
            return None
        raise AwsError(result.stderr.strip() or 'AWS CLI request failed.')
    return json.loads(result.stdout) if result.stdout.strip() else {}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--account-id', help='Render policies for this account without accessing AWS.')
    parser.add_argument('--apply', action='store_true', help='Create or update the dedicated deployment role in the signed-in AWS account.')
    args = parser.parse_args(argv)
    config = json.loads(CONFIG.read_text())
    if not args.apply:
        if args.account_id:
            trust, policy = documents(config, args.account_id)
            print(json.dumps({'trust': trust, 'permissions': policy}, indent=2))
        else:
            print(f"Repository: {config['repository']}\nBucket: {config['bucket']}\nRegion: {config['region']}\nEnvironment: {config['environment']}\nRole: {config['role_name']}")
            print('Planned access: list/read/upload in this bucket. No deletion, bucket-policy changes, or IAM access for the deployment role.')
        print('No AWS changes made. Run with --apply in AWS CloudShell to configure access.')
        return 0
    if not shutil.which('aws'):
        raise RuntimeError('AWS CLI was not found. Run this script in signed-in AWS CloudShell.')
    account = aws('sts', 'get-caller-identity')['Account']
    if args.account_id and account != args.account_id:
        raise RuntimeError('The signed-in AWS account does not match --account-id.')
    aws('s3api', 'head-bucket', '--bucket', config['bucket'], '--expected-bucket-owner', account, '--region', config['region'])
    location = aws('s3api', 'get-bucket-location', '--bucket', config['bucket'], '--expected-bucket-owner', account)
    if (location.get('LocationConstraint') or 'us-east-1') != config['region']:
        raise RuntimeError('The bucket region differs from s3-github-config.json.')
    trust, policy = documents(config, account)
    provider_arn = trust['Statement'][0]['Principal']['Federated']
    tags = {'ManagedBy': 'VeloraS3Automation', 'GitHubRepository': config['repository']}
    role = aws('iam', 'get-role', '--role-name', config['role_name'], optional=True)
    if role:
        actual = {tag['Key']: tag['Value'] for tag in role['Role'].get('Tags', [])}
        if any(actual.get(key) != value for key, value in tags.items()):
            raise RuntimeError('A role with this name already exists and is not managed by this setup. It was not changed.')
        attached = aws('iam', 'list-attached-role-policies', '--role-name', config['role_name'])
        inline = aws('iam', 'list-role-policies', '--role-name', config['role_name'])
        if attached.get('AttachedPolicies') or set(inline.get('PolicyNames', [])) - {POLICY_NAME}:
            raise RuntimeError('The deployment role has extra policies. Review them before rerunning this setup.')
    provider = aws('iam', 'get-open-id-connect-provider', '--open-id-connect-provider-arn', provider_arn, optional=True)
    if provider is None:
        aws('iam', 'create-open-id-connect-provider', '--url', 'https://token.actions.githubusercontent.com', '--client-id-list', 'sts.amazonaws.com')
    elif 'sts.amazonaws.com' not in provider.get('ClientIDList', []):
        aws('iam', 'add-client-id-to-open-id-connect-provider', '--open-id-connect-provider-arn', provider_arn, '--client-id', 'sts.amazonaws.com')
    if role:
        aws('iam', 'update-assume-role-policy', '--role-name', config['role_name'], '--policy-document', json.dumps(trust))
    else:
        aws('iam', 'create-role', '--role-name', config['role_name'], '--assume-role-policy-document', json.dumps(trust), '--max-session-duration', '3600', '--tags', *[f'Key={key},Value={value}' for key, value in tags.items()])
    aws('iam', 'put-role-policy', '--role-name', config['role_name'], '--policy-name', POLICY_NAME, '--policy-document', json.dumps(policy))
    print(f"AWS_ROLE_ARN=arn:aws:iam::{account}:role/{config['role_name']}")
    print(f"Set this as an environment variable in GitHub Settings > Environments > {config['environment']}. No website files were uploaded.")
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (ValueError, RuntimeError, KeyError) as error:
        print(f'Setup failed: {error}', file=sys.stderr)
        sys.exit(1)
