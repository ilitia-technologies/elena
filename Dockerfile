# Run `npm run build` on the host first: this image only packages dist/, dist-server/ and data/.
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8787
COPY package.json package-lock.json ./
# Only express and the telemetry packages stay external to the server bundle; drop the bundled ones.
RUN npm ci --omit=dev --ignore-scripts \
 && npm rm --ignore-scripts openai redis zod @a2ui/agent @a2ui/web_core \
 && npm cache clean --force
COPY --chown=node:node dist ./dist
COPY --chown=node:node dist-server ./dist-server
COPY --chown=node:node data ./data
USER node
EXPOSE 8787
CMD ["node", "--import", "./dist-server/telemetry.js", "dist-server/index.js"]
