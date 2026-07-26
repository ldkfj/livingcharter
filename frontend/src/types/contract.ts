export interface CharterArticle {
  id: number;
  version: number;
  text: string;
}

export interface CharterBundle {
  charter_version: number;
  articles: CharterArticle[];
}

export interface CharterMember {
  address: string;
  active: boolean;
  joined_at?: number;
}

export interface CharterCounts {
  members: number;
  articles: number;
  amendments: number;
  charter_version: number;
}

export interface RulingInfo {
  decision: number;
  decision_name: string;
  approved_amount_wei: string | number;
  cited_article_ids: number[];
  charter_version: number;
  reason: string;
  precedent_seq: number;
}

export interface RequestInfo {
  id: number;
  requester: string;
  amount_wei: string | number;
  purpose: string;
  evidence_urls: string[];
  state: number;
  state_name: string;
  created_at: number;
  ruled_at: number;
  appeal_deadline: number;
  retries: number;
  appealed: boolean;
  appellant: string;
  appeal_argument: string;
  paid: boolean;
  initial_ruling: RulingInfo | null;
  appeal_ruling: RulingInfo | null;
}

export interface PrecedentInfo {
  seq: number;
  request_id: number;
  decision: number;
  decision_name: string;
  requested_wei: string | number;
  approved_wei: string | number;
  cited_article_ids: number[];
  charter_version: number;
  summary: string;
  created_at: number;
  is_appeal: boolean;
}

export interface TreasuryState {
  charter_address: string;
  appeal_window_seconds: number;
  member_cooldown_seconds: number;
  request_count: number;
  precedent_count: number;
  balance_wei?: string;
}

export interface AmendmentInfo {
  id: number;
  proposer: string;
  kind: number;
  kind_name: string;
  target_id: number;
  text_payload: string;
  rationale: string;
  state: number;
  state_name: string;
  created_at: number;
  voting_deadline: number;
  yes_votes: number;
  no_votes: number;
}
