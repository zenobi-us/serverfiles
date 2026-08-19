# Manage a local image

Use a local image definition when the target must build an image without a
registry publication step.

## Add the definition

Create a build context in the machine tree:

```text
systems/minecraft-lan/definitions/prominence/Containerfile
```

Add its directory name to `systems/minecraft-lan/builds`:

```text
prominence
```

Reference the generated image in a Quadlet:

```ini
Image=localhost/serverfiles-prominence:latest
```

## Apply the definition

Run:

```bash
mise run machine:apply --machine minecraft-lan
```

The task hashes every file in the definition directory. It builds the image
when the hash changes or the image is missing. The image stays on the target.

The stored hash is `/var/lib/serverfiles/builds/minecraft-lan-prominence.sha256`.

## Run the container locally

Run:

```bash
mise run container:run --system minecraft-lan --definition prominence
```

The task builds the image and reads runtime values from
`systems/minecraft-lan/quadlets/prominence.container`.

It uses the Quadlet environment variables and published ports. It replaces
production volume sources with local directories under:

```text
.local/containers/minecraft-lan/prominence/
```

The task does not join production Quadlet networks. Podman uses its default
local network.

Print the generated command without starting the container:

```bash
mise run container:run \
  --system minecraft-lan \
  --definition prominence \
  --dry-run
```