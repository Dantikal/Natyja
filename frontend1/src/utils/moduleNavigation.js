// A direct document must never inherit navigation from a different module or account.
export function moduleNavigationKey(module, user, data = {}) {
  return JSON.stringify([module, user?.id ?? user?.email ?? 'guest', data.scope ?? '', data.storageNamespace ?? '', data.id ?? '',
    data.directEditor ? ['document', data.directDocumentId ?? data.initialPeriodId ?? data.directSubmission?.id ?? data.initialResultSubmission?.id ?? data.initialSectionId ?? ''] : ['sections', ...(data.sections || []).map(section => section.id)]
  ]);
}
