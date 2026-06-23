export interface RecoveryReadinessStore {
  acknowledgeCodeSet(userId: string, codeSetId: string): Promise<boolean>;
}
