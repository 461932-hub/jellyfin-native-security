FROM mcr.microsoft.com/dotnet/sdk:10.0.403 AS build
WORKDIR /src
COPY server/ ./server/
COPY SOURCE.SHA256SUMS ./
RUN sha256sum -c SOURCE.SHA256SUMS --quiet && \
    dotnet publish server/Jellyfin.Server/Jellyfin.Server.csproj \
    -c Release -r linux-x64 --self-contained true -o /out \
    -m:1 -nr:false -p:UseSharedCompilation=false \
    -p:Version=12.4.0 -p:AssemblyVersion=12.4.0.0 \
    -p:FileVersion=12.4.0.2 -p:RuntimeFrameworkVersion=10.0.14

FROM jellyfin/jellyfin:12.4@sha256:7da5184caa38c553f219f6772476540081f392a68049e2b68c923f6daf877f8e
LABEL org.opencontainers.image.title="Jellyfin native security preview" \
      org.opencontainers.image.version="12.4-preview3" \
      org.opencontainers.image.source="https://github.com/461932-hub/jellyfin-native-security" \
      org.opencontainers.image.licenses="GPL-2.0"
COPY --from=build /out/ /jellyfin/
COPY server/ /usr/share/jellyfin-native-source/
COPY SOURCE-PATCH.diff /usr/share/jellyfin-native-source/SOURCE-PATCH.diff
COPY licenses/ /usr/share/jellyfin-native-licenses/
COPY docker-entrypoint.sh /usr/local/bin/jellyfin-native-entrypoint
# CasaOS creates fresh host bind directories as root. Only the short bootstrap
# owns empty config/cache mount roots, then gosu drops to UID/GID 1000.
RUN apt-get update && apt-get install -y --no-install-recommends gosu util-linux && \
    rm -rf /var/lib/apt/lists/* && \
    chmod 755 /jellyfin/jellyfin /usr/local/bin/jellyfin-native-entrypoint && \
    mkdir -p /config /cache && chown 1000:1000 /config /cache
USER 0:0
ENTRYPOINT ["/usr/local/bin/jellyfin-native-entrypoint"]
CMD ["/jellyfin/jellyfin"]
# Keep the official matching web client, FFmpeg, entrypoint and path variables.
