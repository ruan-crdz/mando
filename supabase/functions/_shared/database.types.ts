export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
type Table<Row, Insert, Update = Partial<Insert>, Relationships extends unknown[] = []> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: Relationships;
};
type WorldRow = {
  id: string;
  snapshot: string;
  payload: Json;
  published: boolean;
  created_at: string;
};
type CareerRow = {
  id: string;
  user_id: string;
  world_id: string;
  state: Json;
  revision: number;
  created_at: string;
  updated_at: string;
};
type JobRow = {
  id: string;
  user_id: string;
  career_id: string | null;
  event_id: string;
  kind: string;
  status: string;
  output: Json | null;
  error: string | null;
  created_at: string;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      world_snapshots: Table<
        WorldRow,
        Pick<WorldRow, 'id' | 'snapshot' | 'payload'> & Partial<WorldRow>
      >;
      career_saves: Table<
        CareerRow,
        Pick<CareerRow, 'id' | 'user_id' | 'world_id' | 'state'> & Partial<CareerRow>,
        Partial<CareerRow>,
        [
          {
            foreignKeyName: 'career_saves_world_id_fkey';
            columns: ['world_id'];
            isOneToOne: false;
            referencedRelation: 'world_snapshots';
            referencedColumns: ['id'];
          },
        ]
      >;
      ai_jobs: Table<
        JobRow,
        Pick<JobRow, 'user_id' | 'career_id' | 'event_id' | 'kind' | 'status'> & Partial<JobRow>
      >;
      clubs: Table<
        { snapshot_id: string; id: string; name: string; league: string; profile: Json },
        { snapshot_id: string; id: string; name: string; league: string; profile: Json }
      >;
      players: Table<
        {
          snapshot_id: string;
          id: string;
          club_id: string;
          name: string;
          profile: Json;
          attributes: Json;
        },
        {
          snapshot_id: string;
          id: string;
          club_id: string;
          name: string;
          profile: Json;
          attributes: Json;
        }
      >;
    };
    Views: Record<string, never>;
    Functions: {
      save_career: {
        Args: { p_id: string; p_world_id: string; p_state: Json; p_expected_revision: number };
        Returns: number;
      };
      publish_world: { Args: { p_payload: Json }; Returns: string };
      claim_ai_job: {
        Args: { p_user_id: string; p_career_id: string; p_event_id: string; p_kind: string };
        Returns: string;
      };
      claim_portrait_job: {
        Args: { p_user_id: string; p_attempt: string };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
