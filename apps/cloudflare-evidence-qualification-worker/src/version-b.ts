/// <reference path="../.qualification-dist/types/version-b.d.ts" />
export default {
  fetch(_request: Request, env: Env) {
    return new Response(null, {
      status: 204,
      headers: {
        'X-Baci-Evidence-Bundle': 'version-b-204',
        'X-Baci-Evidence-Version': env.CF_VERSION_METADATA.id,
      },
    });
  },
};
