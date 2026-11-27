/**
 * Azure Monitor (Application Insights) through OpenTelemetry. Loaded with `--import` before the app,
 * so the HTTP and Express instrumentations patch the modules the server then imports.
 *
 * Without APPLICATIONINSIGHTS_CONNECTION_STRING nothing is exported: the agent's spans and metrics
 * go to OpenTelemetry's no-op providers.
 */
import {register} from 'node:module';

const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;

if (connectionString) {
  // ESM modules are only instrumented through the loader hook. It is limited to the modules the
  // HTTP instrumentation patches: wrapping every module breaks @a2ui's circular imports.
  register('@opentelemetry/instrumentation/hook.mjs', import.meta.url, {
    data: {include: ['http', 'https', 'node:http', 'node:https']},
  });
  const {useAzureMonitor} = await import('@azure/monitor-opentelemetry');
  const {resourceFromAttributes} = await import('@opentelemetry/resources');
  useAzureMonitor({
    azureMonitorExporterOptions: {connectionString},
    resource: resourceFromAttributes({'service.name': process.env.OTEL_SERVICE_NAME || 'elena'}),
    enableLiveMetrics: true,
  });
  console.log('[telemetry] exporting to Azure Monitor');
}
