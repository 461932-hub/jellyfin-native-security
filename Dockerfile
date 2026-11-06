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
      org.opencontainers.image.version="12.4-preview26" \
      org.opencontainers.image.source="https://github.com/461932-hub/jellyfin-native-security" \
      org.opencontainers.image.licenses="GPL-2.0"
COPY --from=build /out/ /jellyfin/
COPY server/ /usr/share/jellyfin-native-source/
COPY SOURCE-PATCH.diff /usr/share/jellyfin-native-source/SOURCE-PATCH.diff
COPY licenses/ /usr/share/jellyfin-native-licenses/
COPY web/ /jellyfin/jellyfin-web/
COPY web/ /usr/share/jellyfin-native-source/cinema-web/
RUN grep -q '<head>' /jellyfin/jellyfin-web/index.html && \
    sed -i 's#<head>#<head><style>html{background:rgb(20,20,20)}html.native-cinema-boot .mainAnimatedPage{visibility:hidden!important}</style><script src="cinema-boot.js?v=22"></script><link rel="stylesheet" href="cinema-native.css?v=22">#' /jellyfin/jellyfin-web/index.html && \
    sed -i 's#</head>#<script defer src="cinema-native.js?v=22"></script></head>#' /jellyfin/jellyfin-web/index.html
COPY docker-entrypoint.sh /usr/local/bin/jellyfin-native-entrypoint
COPY docker-start.sh /usr/local/bin/jellyfin-native-start
# CasaOS creates fresh host bind directories as root. Only the short bootstrap
# owns empty config/cache mount roots, then setpriv uses PUID/PGID and device groups.
RUN apt-get update && apt-get install -y --no-install-recommends util-linux && \
    rm -rf /var/lib/apt/lists/* && \
    chmod 755 /jellyfin/jellyfin /usr/local/bin/jellyfin-native-entrypoint /usr/local/bin/jellyfin-native-start && \
    mkdir -p /config /cache && chown 1000:1000 /config /cache
USER 0:0
ENV HOME=/config XDG_CACHE_HOME=/cache
ENTRYPOINT ["/usr/local/bin/jellyfin-native-entrypoint"]
CMD ["/jellyfin/jellyfin"]
# Keep native web handlers, FFmpeg and path variables; add presentation assets.
