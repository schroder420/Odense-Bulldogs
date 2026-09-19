export type Round={id:string;title:string;status:'open'|'closing'|'final';starts_at:string;ends_at:string;cutoff_at:string;prize:string;opponent_name?:string;opponent_primary?:string;opponent_stripe?:string};
export type Entry={participant_id:string;nickname:string;score_ms:number;rank:number};
export type Board={configured:boolean;round:Round|null;entries:Entry[];participants:number;serverTime:string};
export type Me={id:string;nickname:string;best:number;rank:number|null;claim:{code:string;rank:number;redeemed:boolean;prize:string;roundTitle:string}|null};
