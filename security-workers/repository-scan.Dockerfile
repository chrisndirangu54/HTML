# Build this image in an isolated CI pipeline with digest-pinned tool binaries.
# This is a runtime scaffold, NOT a deployable scanner image.
FROM node:22-alpine
WORKDIR /app
COPY repository-scan.mjs /app/repository-scan.mjs
USER 65532:65532
ENV SECURITY_REPO_SCANNING_ENABLED=false
ENTRYPOINT ["node","/app/repository-scan.mjs"]
