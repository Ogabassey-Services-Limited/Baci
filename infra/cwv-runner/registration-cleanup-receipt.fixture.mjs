export const absenceReceipt = (containerId) => ({
  bridgeAbsent: true,
  captureRestored: true,
  cgroupAbsent: true,
  containerId,
  containerdInactive: true,
  containers: [],
  dockerInactive: true,
  dockerSocketAbsent: true,
  firewallAbsent: true,
  networkAbsent: true,
  processAbsent: true,
  releaseArtifacts: [],
  schemaVersion: 2,
  stagingArtifacts: [],
  tokenArtifacts: [],
});

export const cleanupOperationReceipt = (operation, options) => {
  if (['remove-isolation', 'remove-network'].includes(operation))
    return (
      options.networkRemovalReceipt ?? { schemaVersion: 1, status: 'removed' }
    );
  if (operation === 'stop-daemons')
    return (
      options.daemonReceipt ?? {
        containerd: 'stopped',
        docker: 'stopped',
        schemaVersion: 1,
      }
    );
  if (operation === 'restore-capture')
    return options.captureReceipt ?? { capture: 'restored', schemaVersion: 1 };
  return undefined;
};
