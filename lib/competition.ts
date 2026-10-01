// Submission time is anchored to the server clock, never the phone's wall clock.
export function submissionDelay(submitAt:number|null|undefined,serverTime:number|undefined,receivedAt:number|undefined,monotonicNow:number){
 if(submitAt==null||serverTime===undefined||receivedAt===undefined)return 0;
 return Math.max(0,submitAt-serverTime-(monotonicNow-receivedAt));
}
