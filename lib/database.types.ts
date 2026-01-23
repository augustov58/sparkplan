export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      agent_actions: {
        Row: {
          action_data: Json
          action_type: string
          agent_name: string
          confidence_score: number | null
          created_at: string
          description: string
          expires_at: string | null
          id: string
          impact_analysis: Json | null
          priority: number
          project_id: string
          reasoning: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
          user_notes: string | null
        }
        Insert: {
          action_data: Json
          action_type: string
          agent_name: string
          confidence_score?: number | null
          created_at?: string
          description: string
          expires_at?: string | null
          id?: string
          impact_analysis?: Json | null
          priority?: number
          project_id: string
          reasoning?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
          user_notes?: string | null
        }
        Update: {
          action_data?: Json
          action_type?: string
          agent_name?: string
          confidence_score?: number | null
          created_at?: string
          description?: string
          expires_at?: string | null
          id?: string
          impact_analysis?: Json | null
          priority?: number
          project_id?: string
          reasoning?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          user_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_actions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_activity_log: {
        Row: {
          agent_action_id: string | null
          agent_name: string
          created_at: string
          details: Json | null
          event_type: string
          id: string
          project_id: string
          user_id: string
        }
        Insert: {
          agent_action_id?: string | null
          agent_name: string
          created_at?: string
          details?: Json | null
          event_type: string
          id?: string
          project_id: string
          user_id: string
        }
        Update: {
          agent_action_id?: string | null
          agent_name?: string
          created_at?: string
          details?: Json | null
          event_type?: string
          id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_activity_log_agent_action_id_fkey"
            columns: ["agent_action_id"]
            isOneToOne: false
            referencedRelation: "agent_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_activity_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_analysis_cache: {
        Row: {
          analysis_type: string
          context_hash: string
          created_at: string
          expires_at: string
          id: string
          model_version: string
          processing_time_ms: number | null
          project_id: string
          results: Json
          tokens_used: number | null
          user_id: string
        }
        Insert: {
          analysis_type: string
          context_hash: string
          created_at?: string
          expires_at?: string
          id?: string
          model_version?: string
          processing_time_ms?: number | null
          project_id: string
          results: Json
          tokens_used?: number | null
          user_id: string
        }
        Update: {
          analysis_type?: string
          context_hash?: string
          created_at?: string
          expires_at?: string
          id?: string
          model_version?: string
          processing_time_ms?: number | null
          project_id?: string
          results?: Json
          tokens_used?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_analysis_cache_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          all_day: boolean | null
          attendees: string[] | null
          completed: boolean | null
          completed_at: string | null
          created_at: string
          description: string | null
          event_date: string
          event_type: string
          id: string
          location: string | null
          notes: string | null
          priority: string
          project_id: string
          related_rfi_id: string | null
          related_site_visit_id: string | null
          reminder_hours_before: number | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          all_day?: boolean | null
          attendees?: string[] | null
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          event_date: string
          event_type?: string
          id?: string
          location?: string | null
          notes?: string | null
          priority?: string
          project_id: string
          related_rfi_id?: string | null
          related_site_visit_id?: string | null
          reminder_hours_before?: number | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          all_day?: boolean | null
          attendees?: string[] | null
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          event_date?: string
          event_type?: string
          id?: string
          location?: string | null
          notes?: string | null
          priority?: string
          project_id?: string
          related_rfi_id?: string | null
          related_site_visit_id?: string | null
          reminder_hours_before?: number | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_related_rfi_id_fkey"
            columns: ["related_rfi_id"]
            isOneToOne: false
            referencedRelation: "rfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_related_site_visit_id_fkey"
            columns: ["related_site_visit_id"]
            isOneToOne: false
            referencedRelation: "site_visits"
            referencedColumns: ["id"]
          },
        ]
      }
      circuits: {
        Row: {
          breaker_amps: number
          circuit_number: number
          conductor_size: string
          created_at: string | null
          description: string
          egc_size: string | null
          id: string
          load_type: string | null
          load_watts: number
          panel_id: string | null
          pole: number
          project_id: string
        }
        Insert: {
          breaker_amps: number
          circuit_number: number
          conductor_size: string
          created_at?: string | null
          description: string
          egc_size?: string | null
          id?: string
          load_type?: string | null
          load_watts: number
          panel_id?: string | null
          pole: number
          project_id: string
        }
        Update: {
          breaker_amps?: number
          circuit_number?: number
          conductor_size?: string
          created_at?: string | null
          description?: string
          egc_size?: string | null
          id?: string
          load_type?: string | null
          load_watts?: number
          panel_id?: string | null
          pole?: number
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "circuits_panel_id_fkey"
            columns: ["panel_id"]
            isOneToOne: false
            referencedRelation: "panels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "circuits_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      feeders: {
        Row: {
          ambient_temperature_c: number | null
          conductor_material: string
          conduit_size: string | null
          conduit_type: string | null
          continuous_load_va: number | null
          created_at: string | null
          design_load_va: number | null
          destination_panel_id: string | null
          destination_transformer_id: string | null
          distance_ft: number
          egc_size: string | null
          id: string
          name: string
          neutral_conductor_size: string | null
          noncontinuous_load_va: number | null
          num_current_carrying: number | null
          phase_conductor_size: string | null
          project_id: string
          source_panel_id: string | null
          total_load_va: number | null
          updated_at: string | null
          voltage_drop_percent: number | null
        }
        Insert: {
          ambient_temperature_c?: number | null
          conductor_material: string
          conduit_size?: string | null
          conduit_type?: string | null
          continuous_load_va?: number | null
          created_at?: string | null
          design_load_va?: number | null
          destination_panel_id?: string | null
          destination_transformer_id?: string | null
          distance_ft: number
          egc_size?: string | null
          id?: string
          name: string
          neutral_conductor_size?: string | null
          noncontinuous_load_va?: number | null
          num_current_carrying?: number | null
          phase_conductor_size?: string | null
          project_id: string
          source_panel_id?: string | null
          total_load_va?: number | null
          updated_at?: string | null
          voltage_drop_percent?: number | null
        }
        Update: {
          ambient_temperature_c?: number | null
          conductor_material?: string
          conduit_size?: string | null
          conduit_type?: string | null
          continuous_load_va?: number | null
          created_at?: string | null
          design_load_va?: number | null
          destination_panel_id?: string | null
          destination_transformer_id?: string | null
          distance_ft?: number
          egc_size?: string | null
          id?: string
          name?: string
          neutral_conductor_size?: string | null
          noncontinuous_load_va?: number | null
          num_current_carrying?: number | null
          phase_conductor_size?: string | null
          project_id?: string
          source_panel_id?: string | null
          total_load_va?: number | null
          updated_at?: string | null
          voltage_drop_percent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "feeders_destination_panel_id_fkey"
            columns: ["destination_panel_id"]
            isOneToOne: false
            referencedRelation: "panels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feeders_destination_transformer_id_fkey"
            columns: ["destination_transformer_id"]
            isOneToOne: false
            referencedRelation: "transformers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feeders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feeders_source_panel_id_fkey"
            columns: ["source_panel_id"]
            isOneToOne: false
            referencedRelation: "panels"
            referencedColumns: ["id"]
          },
        ]
      }
      grounding_details: {
        Row: {
          bonding: string[]
          created_at: string | null
          electrodes: string[]
          gec_size: string
          id: string
          notes: string | null
          project_id: string
          updated_at: string | null
        }
        Insert: {
          bonding?: string[]
          created_at?: string | null
          electrodes?: string[]
          gec_size: string
          id?: string
          notes?: string | null
          project_id: string
          updated_at?: string | null
        }
        Update: {
          bonding?: string[]
          created_at?: string | null
          electrodes?: string[]
          gec_size?: string
          id?: string
          notes?: string | null
          project_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grounding_details_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_items: {
        Row: {
          category: string
          created_at: string | null
          id: string
          inspection_date: string | null
          notes: string | null
          photo_url: string | null
          project_id: string
          requirement: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string | null
          id?: string
          inspection_date?: string | null
          notes?: string | null
          photo_url?: string | null
          project_id: string
          requirement: string
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string | null
          id?: string
          inspection_date?: string | null
          notes?: string | null
          photo_url?: string | null
          project_id?: string
          requirement?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspection_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      inspector_reports: {
        Row: {
          created_at: string
          critical: number
          id: string
          inspected_at: string
          issues: Json | null
          nec_articles_referenced: string[] | null
          passed: number
          passed_checks: Json | null
          project_id: string
          score: number
          total_checks: number
          updated_at: string
          user_id: string
          warnings: number
        }
        Insert: {
          created_at?: string
          critical: number
          id?: string
          inspected_at?: string
          issues?: Json | null
          nec_articles_referenced?: string[] | null
          passed: number
          passed_checks?: Json | null
          project_id: string
          score: number
          total_checks: number
          updated_at?: string
          user_id: string
          warnings: number
        }
        Update: {
          created_at?: string
          critical?: number
          id?: string
          inspected_at?: string
          issues?: Json | null
          nec_articles_referenced?: string[] | null
          passed?: number
          passed_checks?: Json | null
          project_id?: string
          score?: number
          total_checks?: number
          updated_at?: string
          user_id?: string
          warnings?: number
        }
        Relationships: [
          {
            foreignKeyName: "inspector_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      issues: {
        Row: {
          article: string
          assigned_to: string | null
          created_at: string | null
          description: string
          id: string
          location: string | null
          notes: string | null
          photo_url: string | null
          project_id: string
          severity: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          article: string
          assigned_to?: string | null
          created_at?: string | null
          description: string
          id?: string
          location?: string | null
          notes?: string | null
          photo_url?: string | null
          project_id: string
          severity: string
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          article?: string
          assigned_to?: string | null
          created_at?: string | null
          description?: string
          id?: string
          location?: string | null
          notes?: string | null
          photo_url?: string | null
          project_id?: string
          severity?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "issues_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      loads: {
        Row: {
          continuous: boolean | null
          created_at: string | null
          description: string
          id: string
          phase: string
          project_id: string
          type: string
          watts: number
        }
        Insert: {
          continuous?: boolean | null
          created_at?: string | null
          description: string
          id?: string
          phase: string
          project_id: string
          type: string
          watts: number
        }
        Update: {
          continuous?: boolean | null
          created_at?: string | null
          description?: string
          id?: string
          phase?: string
          project_id?: string
          type?: string
          watts?: number
        }
        Relationships: [
          {
            foreignKeyName: "loads_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      panels: {
        Row: {
          aic_rating: number | null
          bus_rating: number
          created_at: string | null
          fed_from: string | null
          fed_from_transformer_id: string | null
          fed_from_type: string | null
          fed_from_circuit_number: number | null
          feeder_breaker_amps: number | null
          feeder_conductor_size: string | null
          feeder_conduit: string | null
          feeder_length: number | null
          id: string
          is_main: boolean | null
          location: string | null
          main_breaker_amps: number | null
          manufacturer: string | null
          model_number: string | null
          name: string
          nema_enclosure_type: string | null
          notes: string | null
          phase: number
          project_id: string
          series_rating: boolean | null
          supplied_by_feeder_id: string | null
          ul_listing: string | null
          voltage: number
        }
        Insert: {
          aic_rating?: number | null
          bus_rating: number
          created_at?: string | null
          fed_from?: string | null
          fed_from_transformer_id?: string | null
          fed_from_type?: string | null
          fed_from_circuit_number?: number | null
          feeder_breaker_amps?: number | null
          feeder_conductor_size?: string | null
          feeder_conduit?: string | null
          feeder_length?: number | null
          id?: string
          is_main?: boolean | null
          location?: string | null
          main_breaker_amps?: number | null
          manufacturer?: string | null
          model_number?: string | null
          name: string
          nema_enclosure_type?: string | null
          notes?: string | null
          phase: number
          project_id: string
          series_rating?: boolean | null
          supplied_by_feeder_id?: string | null
          ul_listing?: string | null
          voltage: number
        }
        Update: {
          aic_rating?: number | null
          bus_rating?: number
          created_at?: string | null
          fed_from?: string | null
          fed_from_transformer_id?: string | null
          fed_from_type?: string | null
          fed_from_circuit_number?: number | null
          feeder_breaker_amps?: number | null
          feeder_conductor_size?: string | null
          feeder_conduit?: string | null
          feeder_length?: number | null
          id?: string
          is_main?: boolean | null
          location?: string | null
          main_breaker_amps?: number | null
          manufacturer?: string | null
          model_number?: string | null
          name?: string
          nema_enclosure_type?: string | null
          notes?: string | null
          phase?: number
          project_id?: string
          series_rating?: boolean | null
          supplied_by_feeder_id?: string | null
          ul_listing?: string | null
          voltage?: number
        }
        Relationships: [
          {
            foreignKeyName: "panels_fed_from_fkey"
            columns: ["fed_from"]
            isOneToOne: false
            referencedRelation: "panels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "panels_fed_from_transformer_id_fkey"
            columns: ["fed_from_transformer_id"]
            isOneToOne: false
            referencedRelation: "transformers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "panels_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "panels_supplied_by_feeder_id_fkey"
            columns: ["supplied_by_feeder_id"]
            isOneToOne: false
            referencedRelation: "feeders"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_name: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          license_number: string | null
          updated_at: string | null
        }
        Insert: {
          company_name?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          license_number?: string | null
          updated_at?: string | null
        }
        Update: {
          company_name?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          license_number?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      project_photos: {
        Row: {
          analysis_results: Json | null
          analyzed: boolean | null
          created_at: string
          description: string | null
          detected_violations: Json[] | null
          file_name: string
          file_size: number | null
          id: string
          location: string | null
          mime_type: string | null
          project_id: string
          storage_path: string
          tags: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          analysis_results?: Json | null
          analyzed?: boolean | null
          created_at?: string
          description?: string | null
          detected_violations?: Json[] | null
          file_name: string
          file_size?: number | null
          id?: string
          location?: string | null
          mime_type?: string | null
          project_id: string
          storage_path: string
          tags?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          analysis_results?: Json | null
          analyzed?: boolean | null
          created_at?: string
          description?: string | null
          detected_violations?: Json[] | null
          file_name?: string
          file_size?: number | null
          id?: string
          location?: string | null
          mime_type?: string | null
          project_id?: string
          storage_path?: string
          tags?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_photos_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          address: string
          created_at: string | null
          id: string
          name: string
          nec_edition: string
          progress: number | null
          service_phase: number
          service_voltage: number
          settings: Json
          status: string
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          address: string
          created_at?: string | null
          id?: string
          name: string
          nec_edition: string
          progress?: number | null
          service_phase: number
          service_voltage: number
          settings?: Json
          status: string
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          address?: string
          created_at?: string | null
          id?: string
          name?: string
          nec_edition?: string
          progress?: number | null
          service_phase?: number
          service_voltage?: number
          settings?: Json
          status?: string
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      rfis: {
        Row: {
          answer: string | null
          assigned_to: string | null
          closed_date: string | null
          created_at: string
          due_date: string | null
          id: string
          notes: string | null
          priority: string
          project_id: string
          question: string
          requested_by: string | null
          responded_by: string | null
          response_date: string | null
          rfi_number: string
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          answer?: string | null
          assigned_to?: string | null
          closed_date?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          priority?: string
          project_id: string
          question: string
          requested_by?: string | null
          responded_by?: string | null
          response_date?: string | null
          rfi_number: string
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          answer?: string | null
          assigned_to?: string | null
          closed_date?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          priority?: string
          project_id?: string
          question?: string
          requested_by?: string | null
          responded_by?: string | null
          response_date?: string | null
          rfi_number?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rfis_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      short_circuit_calculations: {
        Row: {
          calculation_type: string
          created_at: string
          feeder_conductor_size: string | null
          feeder_conduit_type: string | null
          feeder_length: number | null
          feeder_material: string | null
          feeder_phase: number | null
          feeder_voltage: number | null
          id: string
          location_name: string
          notes: string | null
          panel_id: string | null
          project_id: string
          results: Json
          service_amps: number | null
          service_conductor_length: number | null
          service_conductor_material: string | null
          service_conductor_size: string | null
          service_conduit_type: string | null
          service_phase: number | null
          service_voltage: number | null
          source_fault_current: number | null
          transformer_impedance: number | null
          transformer_kva: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          calculation_type: string
          created_at?: string
          feeder_conductor_size?: string | null
          feeder_conduit_type?: string | null
          feeder_length?: number | null
          feeder_material?: string | null
          feeder_phase?: number | null
          feeder_voltage?: number | null
          id?: string
          location_name: string
          notes?: string | null
          panel_id?: string | null
          project_id: string
          results: Json
          service_amps?: number | null
          service_conductor_length?: number | null
          service_conductor_material?: string | null
          service_conductor_size?: string | null
          service_conduit_type?: string | null
          service_phase?: number | null
          service_voltage?: number | null
          source_fault_current?: number | null
          transformer_impedance?: number | null
          transformer_kva?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          calculation_type?: string
          created_at?: string
          feeder_conductor_size?: string | null
          feeder_conduit_type?: string | null
          feeder_length?: number | null
          feeder_material?: string | null
          feeder_phase?: number | null
          feeder_voltage?: number | null
          id?: string
          location_name?: string
          notes?: string | null
          panel_id?: string | null
          project_id?: string
          results?: Json
          service_amps?: number | null
          service_conductor_length?: number | null
          service_conductor_material?: string | null
          service_conductor_size?: string | null
          service_conduit_type?: string | null
          service_phase?: number | null
          service_voltage?: number | null
          source_fault_current?: number | null
          transformer_impedance?: number | null
          transformer_kva?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "short_circuit_calculations_panel_id_fkey"
            columns: ["panel_id"]
            isOneToOne: false
            referencedRelation: "panels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "short_circuit_calculations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      site_visits: {
        Row: {
          action_items: string[] | null
          attendees: string[] | null
          created_at: string
          description: string
          duration_hours: number | null
          id: string
          inspector_name: string | null
          issues_found: string[] | null
          next_visit_date: string | null
          notes: string | null
          photos: string[] | null
          project_id: string
          status: string
          title: string
          updated_at: string
          user_id: string
          visit_date: string
          visit_type: string
          weather_conditions: string | null
        }
        Insert: {
          action_items?: string[] | null
          attendees?: string[] | null
          created_at?: string
          description: string
          duration_hours?: number | null
          id?: string
          inspector_name?: string | null
          issues_found?: string[] | null
          next_visit_date?: string | null
          notes?: string | null
          photos?: string[] | null
          project_id: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
          visit_date?: string
          visit_type?: string
          weather_conditions?: string | null
        }
        Update: {
          action_items?: string[] | null
          attendees?: string[] | null
          created_at?: string
          description?: string
          duration_hours?: number | null
          id?: string
          inspector_name?: string | null
          issues_found?: string[] | null
          next_visit_date?: string | null
          notes?: string | null
          photos?: string[] | null
          project_id?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          visit_date?: string
          visit_type?: string
          weather_conditions?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "site_visits_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      transformers: {
        Row: {
          catalog_number: string | null
          connection_type: string | null
          cooling_type: string | null
          created_at: string | null
          fed_from_circuit_number: number | null
          fed_from_panel_id: string | null
          id: string
          impedance_percent: number | null
          kva_rating: number
          location: string | null
          manufacturer: string | null
          name: string
          nema_type: string | null
          notes: string | null
          primary_breaker_amps: number
          primary_conductor_size: string | null
          primary_phase: number
          primary_voltage: number
          project_id: string
          secondary_breaker_amps: number | null
          secondary_conductor_size: string | null
          secondary_phase: number
          secondary_voltage: number
          supplied_by_feeder_id: string | null
          temperature_rise: number | null
          ul_listing: string | null
          winding_type: string | null
        }
        Insert: {
          catalog_number?: string | null
          connection_type?: string | null
          cooling_type?: string | null
          created_at?: string | null
          fed_from_circuit_number?: number | null
          fed_from_panel_id?: string | null
          id?: string
          impedance_percent?: number | null
          kva_rating: number
          location?: string | null
          manufacturer?: string | null
          name: string
          nema_type?: string | null
          notes?: string | null
          primary_breaker_amps: number
          primary_conductor_size?: string | null
          primary_phase: number
          primary_voltage: number
          project_id: string
          secondary_breaker_amps?: number | null
          secondary_conductor_size?: string | null
          secondary_phase: number
          secondary_voltage: number
          supplied_by_feeder_id?: string | null
          temperature_rise?: number | null
          ul_listing?: string | null
          winding_type?: string | null
        }
        Update: {
          catalog_number?: string | null
          connection_type?: string | null
          cooling_type?: string | null
          created_at?: string | null
          fed_from_circuit_number?: number | null
          fed_from_panel_id?: string | null
          id?: string
          impedance_percent?: number | null
          kva_rating?: number
          location?: string | null
          manufacturer?: string | null
          name?: string
          nema_type?: string | null
          notes?: string | null
          primary_breaker_amps?: number
          primary_conductor_size?: string | null
          primary_phase?: number
          primary_voltage?: number
          project_id?: string
          secondary_breaker_amps?: number | null
          secondary_conductor_size?: string | null
          secondary_phase?: number
          secondary_voltage?: number
          supplied_by_feeder_id?: string | null
          temperature_rise?: number | null
          ul_listing?: string | null
          winding_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transformers_fed_from_panel_id_fkey"
            columns: ["fed_from_panel_id"]
            isOneToOne: false
            referencedRelation: "panels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transformers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transformers_supplied_by_feeder_id_fkey"
            columns: ["supplied_by_feeder_id"]
            isOneToOne: false
            referencedRelation: "feeders"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_expired_agent_data: { Args: never; Returns: undefined }
      generate_rfi_number: { Args: { p_project_id: string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
