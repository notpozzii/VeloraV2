self.__uv$config = {
  prefix: "/service/glass/",
  encodeUrl: Ultraviolet.codec.xor.encode,
  decodeUrl: Ultraviolet.codec.xor.decode,
  handler: "/glass/glass.handler.js?v=popup-realm-20261116",
  client: "/glass/glass.client.js?v=popup-base-20261116",
  bundle: "/glass/glass.bundle.js",
  config: "/glass/glass.config.js",
  sw: "/glass/glass.sw.js",
};
