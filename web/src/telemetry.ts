/**
 * Application Insights in the browser: page views, load performance, errors and the fetch calls
 * to the API, correlated with the server's traces through W3C `traceparent` headers. The connection
 * string comes from the server at run time, so one image serves every environment; without one the
 * SDK is never downloaded.
 */
export async function startTelemetry(): Promise<void> {
  const config: {connectionString?: string} = await fetch('/api/telemetry')
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => ({}));
  if (!config.connectionString) return;
  const {ApplicationInsights, DistributedTracingModes} = await import('@microsoft/applicationinsights-web');
  const appInsights = new ApplicationInsights({
    config: {
      connectionString: config.connectionString,
      distributedTracingMode: DistributedTracingModes.W3C,
      enableAutoRouteTracking: true,
      enableRequestHeaderTracking: false,
      enableResponseHeaderTracking: false,
      // /api/telemetry itself is fetched before the SDK starts.
      excludeRequestFromAutoTrackingPatterns: [/\/api\/telemetry$/],
    },
  });
  appInsights.loadAppInsights();
  appInsights.trackPageView();
}
