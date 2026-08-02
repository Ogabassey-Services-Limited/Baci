/// <reference path="../.qualification-dist/types/version-a.d.ts" />
export default {
  fetch(request: Request, env: Env) {
    if (
      request.url !== 'https://edge-evidence.ogabassey.com/__baci-evidence/a' ||
      !['GET', 'HEAD'].includes(request.method) ||
      request.headers.get('X-Baci-Evidence-Probe') !== '1' ||
      !/^[a-f0-9]{32}$/.test(request.headers.get('X-Baci-Evidence-Run') ?? '')
    )
      return new Response(null, { status: 404 });
    return new Response(null, {
      status: 204,
      headers: {
        'X-Baci-Evidence-Bundle': 'version-a-204',
        'X-Baci-Evidence-Version': env.CF_VERSION_METADATA.id,
      },
    });
  },
};
