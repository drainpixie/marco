{
  lib,
  stdenv,
  pnpm,
  nodejs,
  typescript,
  python3,
  nodePackages,
  ...
}:
stdenv.mkDerivation (final: let
  manifest = lib.importJSON ../package.json;
in {
  inherit (manifest) version;

  src = ../.;
  pname = manifest.name;

  pnpmDeps = pnpm.fetchDeps {
    inherit (final) pname src;

    hash = "sha256-62BDPuk3gl2RKKB5nUGdP4pRAht/MG9d+A9jXaFXJSU=";
    fetcherVersion = 2;
  };

  nativeBuildInputs = [
    nodejs
    typescript
    pnpm.configHook

    python3
    nodePackages.node-gyp
  ];

  buildPhase = ''
    runHook preBuild

    pushd node_modules/sqlite3
    node-gyp rebuild
    popd

    pnpm run build

    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall

    mkdir -p $out

    cp package.json $out/
    cp -r node_modules $out/node_modules
    cp -r dist $out/dist

    runHook postInstall
  '';
})
