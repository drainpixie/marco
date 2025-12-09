{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.11";
    hooks.url = "github:cachix/git-hooks.nix";
  };

  outputs = {
    self,
    hooks,
    nixpkgs,
    ...
  }: let
    inherit (nixpkgs) lib;

    systems = [
      "aarch64-linux"
      "i686-linux"
      "x86_64-linux"
      "aarch64-darwin"
      "x86_64-darwin"
    ];

    forAllSystems = f:
      lib.genAttrs systems (system:
        f rec {
          pkgs = nixpkgs.legacyPackages.${system};
          inherit system;
        });
  in {
    packages = forAllSystems ({pkgs, ...}: {default = pkgs.callPackage ./nix/package.nix {};});

    nixosModules = {
      marco = ./nix/module.nix;
      default = self.nixosModules.marco;
    };

    checks = forAllSystems ({
      system,
      pkgs,
      ...
    }: {
      pre-commit = hooks.lib.${system}.run {
        src = ./.;
        package = pkgs.prek;

        hooks = {
          alejandra.enable = true;
          convco.enable = true;

          eslint = {
            enable = true;
            entry = "pnpm eslint";
            files = "\\.(ts|js|tsx|jsx)$";
          };

          prettier = {
            enable = true;
            excludes = ["flake.lock"];
          };

          statix = {
            enable = true;
            settings.ignore = ["/.direnv"];
          };
        };
      };
    });

    devShells = forAllSystems ({
      pkgs,
      system,
    }: let
      check = self.checks.${system}.pre-commit;
    in {
      default = pkgs.mkShell {
        inherit (check) shellHook;

        buildInputs =
          check.enabledPackages
          ++ (builtins.attrValues {
            inherit (pkgs) nodejs;
            inherit (pkgs.nodePackages) pnpm;
          });
      };
    });

    formatter = forAllSystems ({pkgs, ...}: pkgs.alejandra);
  };
}
