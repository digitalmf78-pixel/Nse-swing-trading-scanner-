export type FilingVersionKind = 'Original' | 'Revision';
export type RevisionMetricStatus =
  | 'ORIGINAL_ONLY_CANDIDATE'
  | 'REVISIONS_IDENTICAL_CANDIDATE'
  | 'LATEST_REVISION_RECONCILED_CANDIDATE'
  | 'REVISION_CHANGED_REVIEW_REQUIRED'
  | 'REVISION_PDF_CONFLICT_REVIEW_REQUIRED'
  | 'BLOCKED_MISSING_VALUE'
  | 'BLOCKED_INVALID_REVISION_HISTORY';

export interface RevisionMetricSnapshot {
  sequenceId: string;
  kind: FilingVersionKind;
  revisionAt: string | null;
  value: number | null;
}

export interface MetricStatementCrossCheck {
  value: number;
  period: string;
  basis: 'Standalone' | 'Consolidated';
  concept: string;
  sourceUrl: string;
}

export interface RevisionMetricDecision {
  status: RevisionMetricStatus;
  selectedValue: number | null;
  latestSequenceId: string | null;
  versionValues: Array<{sequenceId:string;kind:FilingVersionKind;value:number|null}>;
  productionApproved: false;
  explanation: string;
}

const invalid=(explanation:string,versions:RevisionMetricSnapshot[]=[]):RevisionMetricDecision=>({
  status:'BLOCKED_INVALID_REVISION_HISTORY',selectedValue:null,latestSequenceId:null,
  versionValues:versions.map(v=>({sequenceId:v.sequenceId,kind:v.kind,value:v.value})),
  productionApproved:false,explanation,
});

/**
 * Research-only guard: a Revision label does not by itself prove that a changed
 * metric value is correct. A changed latest revision needs an exact statement
 * cross-check for the same period, basis and XBRL concept before it can be used
 * even as a candidate. This never grants production approval.
 */
export function evaluateRevisionMetric(
  period:string,
  basis:'Standalone'|'Consolidated',
  concept:string,
  original:RevisionMetricSnapshot,
  revisions:RevisionMetricSnapshot[],
  crossCheck?:MetricStatementCrossCheck,
):RevisionMetricDecision {
  const all=[original,...revisions];
  if(!period.trim()||!concept.trim()||!original.sequenceId.trim()||original.kind!=='Original'
    ||revisions.some(r=>r.kind!=='Revision'||!r.sequenceId.trim())
    ||new Set(all.map(v=>v.sequenceId)).size!==all.length) {
    return invalid('One unique Original and unique Revision sequence IDs are required',all);
  }
  if(all.some(v=>v.value!==null&&!Number.isFinite(v.value))) return invalid('Metric values must be finite or null',all);
  if(all.some(v=>v.value===null)) return {
    status:'BLOCKED_MISSING_VALUE',selectedValue:null,latestSequenceId:null,
    versionValues:all.map(v=>({sequenceId:v.sequenceId,kind:v.kind,value:v.value})),
    productionApproved:false,explanation:'At least one filing version has a missing metric value; no version is silently substituted.',
  };
  const sorted=[...revisions].sort((a,b)=>{
    if(!a.revisionAt||!b.revisionAt)return 0;
    return Date.parse(a.revisionAt)-Date.parse(b.revisionAt);
  });
  if(sorted.some(v=>!v.revisionAt||!Number.isFinite(Date.parse(v.revisionAt)))
    ||sorted.some((v,i)=>i>0&&Date.parse(v.revisionAt as string)<=Date.parse(sorted[i-1].revisionAt as string))) {
    return invalid('Revision timestamps must be valid and strictly increasing after sorting',all);
  }
  const latest=sorted.at(-1);
  if(!latest) return {
    status:'ORIGINAL_ONLY_CANDIDATE',selectedValue:original.value,latestSequenceId:original.sequenceId,
    versionValues:all.map(v=>({sequenceId:v.sequenceId,kind:v.kind,value:v.value})),
    productionApproved:false,explanation:'No Revision rows exist; Original remains a candidate only.',
  };
  const identical=all.every(v=>v.value===original.value);
  if(identical) return {
    status:'REVISIONS_IDENTICAL_CANDIDATE',selectedValue:latest.value,latestSequenceId:latest.sequenceId,
    versionValues:all.map(v=>({sequenceId:v.sequenceId,kind:v.kind,value:v.value})),
    productionApproved:false,explanation:'All Original/Revision metric values are identical; latest version is still candidate-only.',
  };
  if(!crossCheck) return {
    status:'REVISION_CHANGED_REVIEW_REQUIRED',selectedValue:null,latestSequenceId:latest.sequenceId,
    versionValues:all.map(v=>({sequenceId:v.sequenceId,kind:v.kind,value:v.value})),
    productionApproved:false,explanation:'A Revision changed the metric; no exact-period/basis/concept statement cross-check was supplied.',
  };
  if(crossCheck.period!==period||crossCheck.basis!==basis||crossCheck.concept!==concept
    ||!crossCheck.sourceUrl.trim()||!Number.isFinite(crossCheck.value)) {
    return invalid('Statement cross-check must match exact period, basis, concept and include a source URL',all);
  }
  if(crossCheck.value===latest.value) return {
    status:'LATEST_REVISION_RECONCILED_CANDIDATE',selectedValue:latest.value,latestSequenceId:latest.sequenceId,
    versionValues:all.map(v=>({sequenceId:v.sequenceId,kind:v.kind,value:v.value})),
    productionApproved:false,explanation:'Latest Revision matches an exact-period/basis/concept statement cross-check; still candidate-only pending broader validation.',
  };
  return {
    status:'REVISION_PDF_CONFLICT_REVIEW_REQUIRED',selectedValue:null,latestSequenceId:latest.sequenceId,
    versionValues:all.map(v=>({sequenceId:v.sequenceId,kind:v.kind,value:v.value})),
    productionApproved:false,explanation:'Latest Revision does not match the supplied official statement cross-check; preserve all versions and block the metric.',
  };
}
