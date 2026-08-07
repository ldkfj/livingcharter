export interface CharterArticle {
  id: number;
  version: number;
  text: string;
}

export interface CharterArticleInfo extends CharterArticle {
  status: number;
  updated_by_amendment: number;
  updated_at: number;
}

export interface CharterBundle {
  charter_version: number;
  articles: CharterArticle[];
}

export interface CharterMember {
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
  approved_amount_wei: bigint;
  cited_article_ids: number[];
  charter_version: number;
  reason: string;
  precedent_seq: number;
}

export interface RequestInfo {
  id: number;
  requester: string;
  amount_wei: bigint;
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
  reserved_amount_wei: bigint;
  reservation_active: boolean;
  initial_ruling: RulingInfo | null;
  appeal_ruling: RulingInfo | null;
}

export interface PrecedentInfo {
  seq: number;
  request_id: number;
  decision: number;
  decision_name: string;
  requested_wei: bigint;
  approved_wei: bigint;
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
  balance_wei: bigint;
  reserved_wei: bigint;
  available_balance_wei: bigint;
}

export interface AmendmentInfo {
  id: number;
  kind: number;
  target_article_id: number;
  new_text: string;
  target_member: string;
  proposer: string;
  rationale: string;
  state: number;
  state_name: string;
  yes: number;
  no: number;
  deadline: number;
  created_at: number;
}
