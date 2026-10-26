import contextlib
import importlib.util
import io
import json
import pathlib
import unittest
from unittest.mock import patch

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('setup_s3_github', ROOT / 'scripts/setup-s3-github.py')
setup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(setup)
CONFIG = json.loads(setup.CONFIG.read_text())
ACCOUNT = '123456789012'


class S3GitHubSetupTests(unittest.TestCase):
    def test_oidc_trust_is_exact_repository_and_production_environment(self):
        trust, _ = setup.documents(CONFIG, ACCOUNT)
        statement = trust['Statement'][0]
        conditions = statement['Condition']['StringEquals']
        self.assertEqual(statement['Action'], 'sts:AssumeRoleWithWebIdentity')
        self.assertEqual(conditions['token.actions.githubusercontent.com:aud'], 'sts.amazonaws.com')
        self.assertEqual(conditions['token.actions.githubusercontent.com:sub'],
                         'repo:notpozzii@113958523/VeloraV2@1367408333:environment:s3-production')
        self.assertNotIn('*', json.dumps(trust))

    def test_deploy_role_can_upload_only_to_the_existing_bucket(self):
        _, policy = setup.documents(CONFIG, ACCOUNT)
        allowed = {action for entry in policy['Statement'] for action in entry['Action']}
        self.assertEqual(allowed, {'s3:GetBucketLocation', 's3:ListBucket', 's3:GetObject',
                                  's3:PutObject', 's3:AbortMultipartUpload', 's3:ListMultipartUploadParts'})
        self.assertEqual({entry['Resource'] for entry in policy['Statement']},
                         {'arn:aws:s3:::velorastudy', 'arn:aws:s3:::velorastudy/*'})

    def test_plan_makes_no_aws_calls(self):
        with patch.object(setup, 'aws', side_effect=AssertionError('Unexpected AWS access')):
            with contextlib.redirect_stdout(io.StringIO()) as output:
                self.assertEqual(setup.main([]), 0)
        self.assertIn('No AWS changes made', output.getvalue())

    def test_invalid_account_ids_are_rejected(self):
        for account in ['', '123', '*', '123456789012;whoami']:
            with self.assertRaises(ValueError):
                setup.documents(CONFIG, account)

    def test_apply_refuses_a_role_owned_by_another_setup_before_any_writes(self):
        calls = []
        def fake_aws(*args, **kwargs):
            calls.append(args)
            if args[:2] == ('sts', 'get-caller-identity'):
                return {'Account': ACCOUNT}
            if args[:2] == ('s3api', 'head-bucket'):
                self.assertIn('--expected-bucket-owner', args)
                return {}
            if args[:2] == ('s3api', 'get-bucket-location'):
                return {'LocationConstraint': 'us-east-2'}
            if args[:2] == ('iam', 'get-role'):
                return {'Role': {'Tags': [{'Key': 'ManagedBy', 'Value': 'SomeOtherProject'}]}}
            raise AssertionError(f'Unexpected call: {args[:2]}')
        with patch.object(setup.shutil, 'which', return_value='/usr/bin/aws'), patch.object(setup, 'aws', side_effect=fake_aws):
            with self.assertRaisesRegex(RuntimeError, 'not managed'):
                setup.main(['--apply'])
        self.assertTrue(all(args[1].startswith(('get-', 'head-')) for args in calls))

    def test_apply_creates_a_scoped_role_without_uploading_or_deleting_objects(self):
        calls = []
        def fake_aws(*args, **kwargs):
            calls.append(args)
            if args[:2] == ('sts', 'get-caller-identity'):
                return {'Account': ACCOUNT}
            if args[:2] == ('s3api', 'get-bucket-location'):
                return {'LocationConstraint': 'us-east-2'}
            if args[:2] in [('iam', 'get-role'), ('iam', 'get-open-id-connect-provider')]:
                return None
            return {}
        with patch.object(setup.shutil, 'which', return_value='/usr/bin/aws'), patch.object(setup, 'aws', side_effect=fake_aws):
            with contextlib.redirect_stdout(io.StringIO()) as output:
                self.assertEqual(setup.main(['--apply']), 0)
        self.assertIn(f'AWS_ROLE_ARN=arn:aws:iam::{ACCOUNT}:role/VeloraGitHubS3Deploy', output.getvalue())
        policy_call = next(args for args in calls if args[:2] == ('iam', 'put-role-policy'))
        policy = json.loads(policy_call[policy_call.index('--policy-document') + 1])
        self.assertEqual(policy, setup.documents(CONFIG, ACCOUNT)[1])
        self.assertFalse(any(args[0] == 's3' or 'delete' in args[1] for args in calls))


if __name__ == '__main__':
    unittest.main()
