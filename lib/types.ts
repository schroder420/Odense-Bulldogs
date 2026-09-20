export type Round={id:string;title:string;status:'open'|'closing'|'final';starts_at:string;ends_at:string;cutoff_at:string;prize:string;screen_mode?:'leaderboard'|'rules'|'info'|'winners';screen_title?:string;screen_body?:string;pickup_instructions?:string;opponent_name?:string;opponent_primary?:string;opponent_stripe?:string};
// score_points = overlevelsestid i ms + 1000 per aflevering. time_ms og passes er regnestykket bag.
export type Entry={participant_id:string;nickname:string;score_points:number;time_ms:number;passes:number;rank:number};
export type Board={configured:boolean;round:Round|null;entries:Entry[];participants:number;serverTime:string};
export type Me={id:string;nickname:string;best:number;bestTime:number;bestPasses:number;rank:number|null;claim:{code:string;rank:number;redeemed:boolean;prize:string;roundTitle:string}|null};
