# Prominence II definition

This directory defines the Prominence II Hasturian Era server image.

Packwiz metadata locks hosted files by URL and hash. The image build downloads
only files marked for the server or both sides.

`config/` and `defaultconfigs/` came from the existing server staging tree.
They are copied into the image and synchronized into `/data` at container
startup.

`assets/mods/` contains two files that the CurseForge manifest did not provide:

- `Prominent-GLOBAL-MC1.20.1-3.9.4.jar`
- `offlinelan-1.1.1.jar`

These exceptions remain in Git until a stable hosted source replaces them.
The world does not belong here. It stays in `/var/lib/minecraft/prominence/data`
on `minecraft.lan`.
