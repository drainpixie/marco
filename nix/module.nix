{
  config,
  lib,
  pkgs,
  ...
}: let
  cfg = config.services.marco;

  inherit (lib) mkEnableOption mkOption mkIf types literalExpression;
in {
  options.services.marco = {
    enable = mkEnableOption "Marco";

    package = mkOption {
      type = types.package;
      default = pkgs.callPackage ./package.nix {};
      defaultText = literalExpression "pkgs.marco";
      description = "The package to use.";
    };

    environmentFile = mkOption {
      type = types.nullOr types.path;
      default = null;
      example = "/run/secrets/marco-env";
      description = "The environment file.";
    };

    dataDir = mkOption {
      type = types.path;
      default = "/var/lib/marco";
      description = "Directory to store data persistently.";
    };

    user = mkOption {
      type = types.str;
      default = "marco";
      description = "User account.";
    };

    group = mkOption {
      type = types.str;
      default = "marco";
      description = "User group.";
    };
  };

  config = mkIf cfg.enable {
    systemd.services.marco = {
      description = "Marco";

      wantedBy = ["multi-user.target"];
      after = ["network.target"];

      serviceConfig = {
        Type = "simple";

        User = cfg.user;
        Group = cfg.group;

        WorkingDirectory = cfg.dataDir;
        ExecStart = "${pkgs.nodejs}/bin/node ${cfg.package}/dist/index.js";
        Restart = "on-failure";
        RestartSec = "10s";

        ProtectSystem = "strict";
        NoNewPrivileges = true;
        PrivateTmp = true;
        ProtectHome = true;
        ReadWritePaths = [cfg.dataDir];

        EnvironmentFile = mkIf (cfg.environmentFile != null) cfg.environmentFile;
      };
    };

    users.users.${cfg.user} = {
      inherit (cfg) group;

      isSystemUser = true;
      createHome = true;

      home = cfg.dataDir;
    };

    users.groups.${cfg.group} = {};
  };
}
