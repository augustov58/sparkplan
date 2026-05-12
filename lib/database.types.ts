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
      estimate_line_items: {
        Row: {
          assembly_key: string | null
          category: string
          created_at: string
          description: string
          estimate_id: string
          id: string
          line_total: number
          markup_overridden: boolean
          notes: string | null
          position: number
          quantity: number
          source_id: string | null
          source_kind: string | null
          taxable: boolean
          unit: string | null
          unit_cost: number
          unit_price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          assembly_key?: string | null
          category: string
          created_at?: string
          description: string
          estimate_id: string
          id?: string
          line_total?: number
          markup_overridden?: boolean
          notes?: string | null
          position?: number
          quantity?: number
          source_id?: string | null
          source_kind?: string | null
          taxable?: boolean
          unit?: string | null
          unit_cost?: number
          unit_price?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          assembly_key?: string | null
          category?: string
          created_at?: string
          description?: string
          estimate_id?: string
          id?: string
          line_total?: number
          markup_overridden?: boolean
          notes?: string | null
          position?: number
          quantity?: number
          source_id?: string | null
          source_kind?: string | null
          taxable?: boolean
          unit?: string | null
          unit_cost?: number
          unit_price?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "estimate_line_items_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
        ]
      }
      estimates: {
        Row: {
          bid_pdf_generated_at: string | null
          bid_pdf_url: string | null
          created_at: string
          customer_address: string | null
          customer_email: string | null
          customer_name: string | null
          decided_at: string | null
          estimate_number: string | null
          exclusions: string | null
          expires_at: string | null
          id: string
          internal_notes: string | null
          markup_amount: number
          markup_pct: number
          name: string
          outcome_reason: string | null
          parent_estimate_id: string | null
          payment_terms: string | null
          project_id: string
          revision: number
          scope_summary: string | null
          status: string
          submitted_at: string | null
          subtotal_labor: number
          subtotal_materials: number
          subtotal_other: number
          tax_amount: number
          tax_pct: number
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          bid_pdf_generated_at?: string | null
          bid_pdf_url?: string | null
          created_at?: string
          customer_address?: string | null
          customer_email?: string | null
          customer_name?: string | null
          decided_at?: string | null
          estimate_number?: string | null
          exclusions?: string | null
          expires_at?: string | null
          id?: string
          internal_notes?: string | null
          markup_amount?: number
          markup_pct?: number
          name: string
          outcome_reason?: string | null
          parent_estimate_id?: string | null
          payment_terms?: string | null
          project_id: string
          revision?: number
          scope_summary?: string | null
          status?: string
          submitted_at?: string | null
          subtotal_labor?: number
          subtotal_materials?: number
          subtotal_other?: number
          tax_amount?: number
          tax_pct?: number
          total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          bid_pdf_generated_at?: string | null
          bid_pdf_url?: string | null
          created_at?: string
          customer_address?: string | null
          customer_email?: string | null
          customer_name?: string | null
          decided_at?: string | null
          estimate_number?: string | null
          exclusions?: string | null
          expires_at?: string | null
          id?: string
          internal_notes?: string | null
          markup_amount?: number
          markup_pct?: number
          name?: string
          outcome_reason?: string | null
          parent_estimate_id?: string | null
          payment_terms?: string | null
          project_id?: string
          revision?: number
          scope_summary?: string | null
          status?: string
          submitted_at?: string | null
          subtotal_labor?: number
          subtotal_materials?: number
          subtotal_other?: number
          tax_amount?: number
          tax_pct?: number
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "estimates_parent_estimate_id_fkey"
            columns: ["parent_estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_interest: {
        Row: {
          created_at: string
          feature_name: string
          id: string
          note: string | null
          project_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          feature_name: string
          id?: string
          note?: string | null
          project_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          feature_name?: string
          id?: string
          note?: string | null
          project_id?: string | null
          user_id?: string
        }
        Relationships: []
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
          is_service_entrance: boolean
          name: string
          neutral_conductor_size: string | null
          noncontinuous_load_va: number | null
          num_current_carrying: number | null
          phase_conductor_size: string | null
          project_id: string
          sets_in_parallel: number
          source_panel_id: string | null
          source_transformer_id: string | null
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
          is_service_entrance?: boolean
          name: string
          neutral_conductor_size?: string | null
          noncontinuous_load_va?: number | null
          num_current_carrying?: number | null
          phase_conductor_size?: string | null
          project_id: string
          sets_in_parallel?: number
          source_panel_id?: string | null
          source_transformer_id?: string | null
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
          is_service_entrance?: boolean
          name?: string
          neutral_conductor_size?: string | null
          noncontinuous_load_va?: number | null
          num_current_carrying?: number | null
          phase_conductor_size?: string | null
          project_id?: string
          sets_in_parallel?: number
          source_panel_id?: string | null
          source_transformer_id?: string | null
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
          {
            foreignKeyName: "feeders_source_transformer_id_fkey"
            columns: ["source_transformer_id"]
            isOneToOne: false
            referencedRelation: "transformers"
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
      invoices: {
        Row: {
          balance_due: number
          created_at: string
          customer_address: string | null
          customer_email: string | null
          customer_name: string | null
          customer_po_number: string | null
          description: string | null
          due_date: string | null
          id: string
          internal_notes: string | null
          invoice_date: string
          invoice_number: string
          invoice_pdf_generated_at: string | null
          invoice_pdf_url: string | null
          notes: string | null
          paid_amount: number
          paid_at: string | null
          period_end: string
          period_start: string
          project_id: string
          sent_at: string | null
          status: string
          subtotal: number
          subtotal_labor: number
          subtotal_materials: number
          tax_amount: number
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance_due?: number
          created_at?: string
          customer_address?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_po_number?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          internal_notes?: string | null
          invoice_date?: string
          invoice_number: string
          invoice_pdf_generated_at?: string | null
          invoice_pdf_url?: string | null
          notes?: string | null
          paid_amount?: number
          paid_at?: string | null
          period_end: string
          period_start: string
          project_id: string
          sent_at?: string | null
          status?: string
          subtotal?: number
          subtotal_labor?: number
          subtotal_materials?: number
          tax_amount?: number
          total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance_due?: number
          created_at?: string
          customer_address?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_po_number?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          internal_notes?: string | null
          invoice_date?: string
          invoice_number?: string
          invoice_pdf_generated_at?: string | null
          invoice_pdf_url?: string | null
          notes?: string | null
          paid_amount?: number
          paid_at?: string | null
          period_end?: string
          period_start?: string
          project_id?: string
          sent_at?: string | null
          status?: string
          subtotal?: number
          subtotal_labor?: number
          subtotal_materials?: number
          tax_amount?: number
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_project_id_fkey"
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
          permit_inspection_id: string | null
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
          permit_inspection_id?: string | null
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
          permit_inspection_id?: string | null
          photo_url?: string | null
          project_id?: string
          severity?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "issues_permit_inspection_id_fkey"
            columns: ["permit_inspection_id"]
            isOneToOne: false
            referencedRelation: "permit_inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      jurisdictions: {
        Row: {
          ahj_name: string | null
          ahj_website: string | null
          city: string
          county: string | null
          created_at: string
          data_source: string | null
          estimated_review_days: number | null
          id: string
          is_active: boolean | null
          jurisdiction_name: string
          last_verified_date: string | null
          nec_edition: string | null
          notes: string | null
          required_calculations: string[] | null
          required_documents: string[] | null
          source_url: string | null
          state: string
          updated_at: string
        }
        Insert: {
          ahj_name?: string | null
          ahj_website?: string | null
          city: string
          county?: string | null
          created_at?: string
          data_source?: string | null
          estimated_review_days?: number | null
          id?: string
          is_active?: boolean | null
          jurisdiction_name: string
          last_verified_date?: string | null
          nec_edition?: string | null
          notes?: string | null
          required_calculations?: string[] | null
          required_documents?: string[] | null
          source_url?: string | null
          state: string
          updated_at?: string
        }
        Update: {
          ahj_name?: string | null
          ahj_website?: string | null
          city?: string
          county?: string | null
          created_at?: string
          data_source?: string | null
          estimated_review_days?: number | null
          id?: string
          is_active?: boolean | null
          jurisdiction_name?: string
          last_verified_date?: string | null
          nec_edition?: string | null
          notes?: string | null
          required_calculations?: string[] | null
          required_documents?: string[] | null
          source_url?: string | null
          state?: string
          updated_at?: string
        }
        Relationships: []
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
      material_entries: {
        Row: {
          billing_amount: number
          billing_unit_price: number
          cost_amount: number
          cost_code: string | null
          created_at: string
          description: string
          id: string
          installed_date: string
          invoice_id: string | null
          invoice_unit_cost: number
          markup_pct: number
          project_id: string
          quantity: number
          receipt_url: string | null
          supplier_invoice_number: string | null
          supplier_name: string | null
          taxable: boolean
          unit: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          billing_amount?: number
          billing_unit_price: number
          cost_amount?: number
          cost_code?: string | null
          created_at?: string
          description: string
          id?: string
          installed_date: string
          invoice_id?: string | null
          invoice_unit_cost: number
          markup_pct?: number
          project_id: string
          quantity?: number
          receipt_url?: string | null
          supplier_invoice_number?: string | null
          supplier_name?: string | null
          taxable?: boolean
          unit?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          billing_amount?: number
          billing_unit_price?: number
          cost_amount?: number
          cost_code?: string | null
          created_at?: string
          description?: string
          id?: string
          installed_date?: string
          invoice_id?: string | null
          invoice_unit_cost?: number
          markup_pct?: number
          project_id?: string
          quantity?: number
          receipt_url?: string | null
          supplier_invoice_number?: string | null
          supplier_name?: string | null
          taxable?: boolean
          unit?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_entries_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      meter_stacks: {
        Row: {
          bus_rating_amps: number
          created_at: string | null
          ct_ratio: string | null
          id: string
          location: string | null
          manufacturer: string | null
          model_number: string | null
          name: string
          num_meter_positions: number
          phase: number
          project_id: string
          updated_at: string | null
          voltage: number
        }
        Insert: {
          bus_rating_amps?: number
          created_at?: string | null
          ct_ratio?: string | null
          id?: string
          location?: string | null
          manufacturer?: string | null
          model_number?: string | null
          name?: string
          num_meter_positions?: number
          phase?: number
          project_id: string
          updated_at?: string | null
          voltage?: number
        }
        Update: {
          bus_rating_amps?: number
          created_at?: string | null
          ct_ratio?: string | null
          id?: string
          location?: string | null
          manufacturer?: string | null
          model_number?: string | null
          name?: string
          num_meter_positions?: number
          phase?: number
          project_id?: string
          updated_at?: string | null
          voltage?: number
        }
        Relationships: [
          {
            foreignKeyName: "meter_stacks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      meters: {
        Row: {
          breaker_amps: number | null
          created_at: string | null
          id: string
          meter_stack_id: string
          meter_type: string
          name: string
          panel_id: string | null
          position_number: number | null
          project_id: string
          updated_at: string | null
        }
        Insert: {
          breaker_amps?: number | null
          created_at?: string | null
          id?: string
          meter_stack_id: string
          meter_type?: string
          name: string
          panel_id?: string | null
          position_number?: number | null
          project_id: string
          updated_at?: string | null
        }
        Update: {
          breaker_amps?: number | null
          created_at?: string | null
          id?: string
          meter_stack_id?: string
          meter_type?: string
          name?: string
          panel_id?: string | null
          position_number?: number | null
          project_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meters_meter_stack_id_fkey"
            columns: ["meter_stack_id"]
            isOneToOne: false
            referencedRelation: "meter_stacks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meters_panel_id_fkey"
            columns: ["panel_id"]
            isOneToOne: false
            referencedRelation: "panels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meters_project_id_fkey"
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
          fed_from_circuit_number: number | null
          fed_from_meter_stack_id: string | null
          fed_from_transformer_id: string | null
          fed_from_type: string | null
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
          num_spaces: number
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
          fed_from_circuit_number?: number | null
          fed_from_meter_stack_id?: string | null
          fed_from_transformer_id?: string | null
          fed_from_type?: string | null
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
          num_spaces?: number
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
          fed_from_circuit_number?: number | null
          fed_from_meter_stack_id?: string | null
          fed_from_transformer_id?: string | null
          fed_from_type?: string | null
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
          num_spaces?: number
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
            foreignKeyName: "panels_fed_from_meter_stack_id_fkey"
            columns: ["fed_from_meter_stack_id"]
            isOneToOne: false
            referencedRelation: "meter_stacks"
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
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_id: string
          notes: string | null
          payment_date: string
          payment_method: string | null
          reference: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          invoice_id: string
          notes?: string | null
          payment_date?: string
          payment_method?: string | null
          reference?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string | null
          reference?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      permit_inspections: {
        Row: {
          created_at: string
          description: string | null
          id: string
          inspection_type: string
          inspector_name: string | null
          parent_inspection_id: string | null
          performed_at: string | null
          permit_id: string
          project_id: string
          result_notes: string | null
          scheduled_date: string | null
          scheduled_window: string | null
          sequence: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          inspection_type: string
          inspector_name?: string | null
          parent_inspection_id?: string | null
          performed_at?: string | null
          permit_id: string
          project_id: string
          result_notes?: string | null
          scheduled_date?: string | null
          scheduled_window?: string | null
          sequence?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          inspection_type?: string
          inspector_name?: string | null
          parent_inspection_id?: string | null
          performed_at?: string | null
          permit_id?: string
          project_id?: string
          result_notes?: string | null
          scheduled_date?: string | null
          scheduled_window?: string | null
          sequence?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "permit_inspections_parent_inspection_id_fkey"
            columns: ["parent_inspection_id"]
            isOneToOne: false
            referencedRelation: "permit_inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permit_inspections_permit_id_fkey"
            columns: ["permit_id"]
            isOneToOne: false
            referencedRelation: "permits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permit_inspections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      permits: {
        Row: {
          ahj_contact_email: string | null
          ahj_contact_name: string | null
          ahj_contact_phone: string | null
          ahj_jurisdiction: string
          approved_at: string | null
          closed_at: string | null
          conditions: Json
          created_at: string
          description: string | null
          expires_at: string | null
          fee_amount: number | null
          fee_paid_at: string | null
          fee_receipt_url: string | null
          id: string
          notes: string | null
          packet_generated_at: string | null
          packet_url: string | null
          permit_number: string | null
          permit_type: string
          plan_review_id: string | null
          project_id: string
          status: string
          submitted_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ahj_contact_email?: string | null
          ahj_contact_name?: string | null
          ahj_contact_phone?: string | null
          ahj_jurisdiction: string
          approved_at?: string | null
          closed_at?: string | null
          conditions?: Json
          created_at?: string
          description?: string | null
          expires_at?: string | null
          fee_amount?: number | null
          fee_paid_at?: string | null
          fee_receipt_url?: string | null
          id?: string
          notes?: string | null
          packet_generated_at?: string | null
          packet_url?: string | null
          permit_number?: string | null
          permit_type?: string
          plan_review_id?: string | null
          project_id: string
          status?: string
          submitted_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ahj_contact_email?: string | null
          ahj_contact_name?: string | null
          ahj_contact_phone?: string | null
          ahj_jurisdiction?: string
          approved_at?: string | null
          closed_at?: string | null
          conditions?: Json
          created_at?: string
          description?: string | null
          expires_at?: string | null
          fee_amount?: number | null
          fee_paid_at?: string | null
          fee_receipt_url?: string | null
          id?: string
          notes?: string | null
          packet_generated_at?: string | null
          packet_url?: string | null
          permit_number?: string | null
          permit_type?: string
          plan_review_id?: string | null
          project_id?: string
          status?: string
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "permits_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
      project_attachments: {
        Row: {
          artifact_type: string
          display_title: string | null
          filename: string
          id: string
          page_count: number | null
          project_id: string
          storage_path: string
          uploaded_at: string
          user_id: string
        }
        Insert: {
          artifact_type: string
          display_title?: string | null
          filename: string
          id?: string
          page_count?: number | null
          project_id: string
          storage_path: string
          uploaded_at?: string
          user_id: string
        }
        Update: {
          artifact_type?: string
          display_title?: string | null
          filename?: string
          id?: string
          page_count?: number | null
          project_id?: string
          storage_path?: string
          uploaded_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_attachments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_billing_settings: {
        Row: {
          created_at: string
          customer_address: string | null
          customer_email: string | null
          customer_name: string | null
          customer_po_number: string | null
          default_billable_rate: number | null
          default_cost_rate: number | null
          default_material_markup_pct: number
          invoice_prefix: string | null
          next_invoice_number: number
          payment_terms_days: number
          project_id: string
          tax_pct: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          customer_address?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_po_number?: string | null
          default_billable_rate?: number | null
          default_cost_rate?: number | null
          default_material_markup_pct?: number
          invoice_prefix?: string | null
          next_invoice_number?: number
          payment_terms_days?: number
          project_id: string
          tax_pct?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          customer_address?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_po_number?: string | null
          default_billable_rate?: number | null
          default_cost_rate?: number | null
          default_material_markup_pct?: number
          invoice_prefix?: string | null
          next_invoice_number?: number
          payment_terms_days?: number
          project_id?: string
          tax_pct?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_billing_settings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
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
          jurisdiction_id: string | null
          name: string
          nec_edition: string
          progress: number | null
          service_amps: number | null
          service_phase: number
          service_voltage: number
          settings: Json
          status: string
          type: string
          updated_at: string | null
          user_id: string
          utility_available_fault_current_a: number | null
          utility_transformer_impedance_pct: number | null
          utility_transformer_kva: number | null
        }
        Insert: {
          address: string
          created_at?: string | null
          id?: string
          jurisdiction_id?: string | null
          name: string
          nec_edition: string
          progress?: number | null
          service_amps?: number | null
          service_phase: number
          service_voltage: number
          settings?: Json
          status: string
          type: string
          updated_at?: string | null
          user_id: string
          utility_available_fault_current_a?: number | null
          utility_transformer_impedance_pct?: number | null
          utility_transformer_kva?: number | null
        }
        Update: {
          address?: string
          created_at?: string | null
          id?: string
          jurisdiction_id?: string | null
          name?: string
          nec_edition?: string
          progress?: number | null
          service_amps?: number | null
          service_phase?: number
          service_voltage?: number
          settings?: Json
          status?: string
          type?: string
          updated_at?: string | null
          user_id?: string
          utility_available_fault_current_a?: number | null
          utility_transformer_impedance_pct?: number | null
          utility_transformer_kva?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_jurisdiction_id_fkey"
            columns: ["jurisdiction_id"]
            isOneToOne: false
            referencedRelation: "jurisdictions"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_code_redemptions: {
        Row: {
          id: string
          previous_plan: string | null
          previous_status: string | null
          promo_code_id: string | null
          redeemed_at: string | null
          user_id: string | null
        }
        Insert: {
          id?: string
          previous_plan?: string | null
          previous_status?: string | null
          promo_code_id?: string | null
          redeemed_at?: string | null
          user_id?: string | null
        }
        Update: {
          id?: string
          previous_plan?: string | null
          previous_status?: string | null
          promo_code_id?: string | null
          redeemed_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "promo_code_redemptions_promo_code_id_fkey"
            columns: ["promo_code_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_codes: {
        Row: {
          code: string
          created_at: string | null
          created_by: string | null
          description: string | null
          duration_days: number | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          max_uses: number | null
          plan: string | null
          updated_at: string | null
          uses_count: number | null
        }
        Insert: {
          code: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          duration_days?: number | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          plan?: string | null
          updated_at?: string | null
          uses_count?: number | null
        }
        Update: {
          code?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          duration_days?: number | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          plan?: string | null
          updated_at?: string | null
          uses_count?: number | null
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
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          canceled_at: string | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          permits_used_this_month: number | null
          plan: string
          projects_count: number | null
          status: string
          stripe_customer_id: string | null
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          trial_end: string | null
          trial_start: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          canceled_at?: string | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          permits_used_this_month?: number | null
          plan?: string
          projects_count?: number | null
          status?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          canceled_at?: string | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          permits_used_this_month?: number | null
          plan?: string
          projects_count?: number | null
          status?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      support_gmail_sync_state: {
        Row: {
          id: number
          last_error: string | null
          last_history_id: string | null
          last_synced_at: string | null
          updated_at: string
        }
        Insert: {
          id?: number
          last_error?: string | null
          last_history_id?: string | null
          last_synced_at?: string | null
          updated_at?: string
        }
        Update: {
          id?: number
          last_error?: string | null
          last_history_id?: string | null
          last_synced_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      support_replies: {
        Row: {
          attachment_urls: string[] | null
          created_at: string | null
          id: string
          is_admin: boolean
          message: string
          ticket_id: string
          user_id: string
        }
        Insert: {
          attachment_urls?: string[] | null
          created_at?: string | null
          id?: string
          is_admin?: boolean
          message: string
          ticket_id: string
          user_id: string
        }
        Update: {
          attachment_urls?: string[] | null
          created_at?: string | null
          id?: string
          is_admin?: boolean
          message?: string
          ticket_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_replies_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          payload: Json
          source: string
          ticket_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
          source: string
          ticket_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          source?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_events_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_investigations: {
        Row: {
          artifacts: Json | null
          completed_at: string | null
          created_at: string
          error_message: string | null
          findings: string | null
          id: string
          investigator: string
          notified_at: string | null
          notified_via: string | null
          status: string
          ticket_id: string
          triggered_by_event_id: string | null
          updated_at: string
        }
        Insert: {
          artifacts?: Json | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          findings?: string | null
          id?: string
          investigator?: string
          notified_at?: string | null
          notified_via?: string | null
          status?: string
          ticket_id: string
          triggered_by_event_id?: string | null
          updated_at?: string
        }
        Update: {
          artifacts?: Json | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          findings?: string | null
          id?: string
          investigator?: string
          notified_at?: string | null
          notified_via?: string | null
          status?: string
          ticket_id?: string
          triggered_by_event_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_investigations_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_ticket_investigations_triggered_by_event_id_fkey"
            columns: ["triggered_by_event_id"]
            isOneToOne: false
            referencedRelation: "support_ticket_events"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          attachment_urls: string[] | null
          browser_info: string | null
          category: string
          created_at: string | null
          id: string
          message: string
          page_url: string | null
          plan_tier: string | null
          priority: string
          status: string
          subject: string
          updated_at: string | null
          user_email: string
          user_id: string
          user_last_seen_at: string | null
        }
        Insert: {
          attachment_urls?: string[] | null
          browser_info?: string | null
          category: string
          created_at?: string | null
          id?: string
          message: string
          page_url?: string | null
          plan_tier?: string | null
          priority?: string
          status?: string
          subject: string
          updated_at?: string | null
          user_email: string
          user_id: string
          user_last_seen_at?: string | null
        }
        Update: {
          attachment_urls?: string[] | null
          browser_info?: string | null
          category?: string
          created_at?: string | null
          id?: string
          message?: string
          page_url?: string | null
          plan_tier?: string | null
          priority?: string
          status?: string
          subject?: string
          updated_at?: string | null
          user_email?: string
          user_id?: string
          user_last_seen_at?: string | null
        }
        Relationships: []
      }
      time_entries: {
        Row: {
          billable_amount: number
          billable_rate: number
          cost_amount: number | null
          cost_code: string | null
          cost_rate: number | null
          created_at: string
          description: string | null
          hours: number
          id: string
          invoice_id: string | null
          project_id: string
          updated_at: string
          user_id: string
          work_date: string
          worker_name: string
        }
        Insert: {
          billable_amount?: number
          billable_rate: number
          cost_amount?: number | null
          cost_code?: string | null
          cost_rate?: number | null
          created_at?: string
          description?: string | null
          hours: number
          id?: string
          invoice_id?: string | null
          project_id: string
          updated_at?: string
          user_id: string
          work_date: string
          worker_name: string
        }
        Update: {
          billable_amount?: number
          billable_rate?: number
          cost_amount?: number | null
          cost_code?: string | null
          cost_rate?: number | null
          created_at?: string
          description?: string | null
          hours?: number
          id?: string
          invoice_id?: string | null
          project_id?: string
          updated_at?: string
          user_id?: string
          work_date?: string
          worker_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_project_id_fkey"
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
      project_billing_settings: {
        Row: {
          project_id: string
          user_id: string
          default_billable_rate: number | null
          default_cost_rate: number | null
          default_material_markup_pct: number
          tax_pct: number
          payment_terms_days: number
          invoice_prefix: string | null
          next_invoice_number: number
          customer_name: string | null
          customer_email: string | null
          customer_address: string | null
          customer_po_number: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          project_id: string
          user_id: string
          default_billable_rate?: number | null
          default_cost_rate?: number | null
          default_material_markup_pct?: number
          tax_pct?: number
          payment_terms_days?: number
          invoice_prefix?: string | null
          next_invoice_number?: number
          customer_name?: string | null
          customer_email?: string | null
          customer_address?: string | null
          customer_po_number?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          project_id?: string
          user_id?: string
          default_billable_rate?: number | null
          default_cost_rate?: number | null
          default_material_markup_pct?: number
          tax_pct?: number
          payment_terms_days?: number
          invoice_prefix?: string | null
          next_invoice_number?: number
          customer_name?: string | null
          customer_email?: string | null
          customer_address?: string | null
          customer_po_number?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_billing_settings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          id: string
          project_id: string
          user_id: string
          worker_name: string
          work_date: string
          hours: number
          description: string | null
          cost_code: string | null
          billable_rate: number
          cost_rate: number | null
          billable_amount: number
          cost_amount: number | null
          invoice_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          user_id: string
          worker_name: string
          work_date: string
          hours: number
          description?: string | null
          cost_code?: string | null
          billable_rate: number
          cost_rate?: number | null
          billable_amount?: number
          cost_amount?: number | null
          invoice_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          user_id?: string
          worker_name?: string
          work_date?: string
          hours?: number
          description?: string | null
          cost_code?: string | null
          billable_rate?: number
          cost_rate?: number | null
          billable_amount?: number
          cost_amount?: number | null
          invoice_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      material_entries: {
        Row: {
          id: string
          project_id: string
          user_id: string
          installed_date: string
          description: string
          cost_code: string | null
          quantity: number
          unit: string | null
          invoice_unit_cost: number
          markup_pct: number
          billing_unit_price: number
          taxable: boolean
          billing_amount: number
          cost_amount: number
          receipt_url: string | null
          supplier_name: string | null
          supplier_invoice_number: string | null
          invoice_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          user_id: string
          installed_date: string
          description: string
          cost_code?: string | null
          quantity?: number
          unit?: string | null
          invoice_unit_cost: number
          markup_pct?: number
          billing_unit_price: number
          taxable?: boolean
          billing_amount?: number
          cost_amount?: number
          receipt_url?: string | null
          supplier_name?: string | null
          supplier_invoice_number?: string | null
          invoice_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          user_id?: string
          installed_date?: string
          description?: string
          cost_code?: string | null
          quantity?: number
          unit?: string | null
          invoice_unit_cost?: number
          markup_pct?: number
          billing_unit_price?: number
          taxable?: boolean
          billing_amount?: number
          cost_amount?: number
          receipt_url?: string | null
          supplier_name?: string | null
          supplier_invoice_number?: string | null
          invoice_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_confirm_user: { Args: { target_email: string }; Returns: Json }
      admin_create_user: {
        Args: { user_email: string; user_password: string; user_plan?: string }
        Returns: Json
      }
      admin_delete_user: { Args: { target_email: string }; Returns: Json }
      admin_search_users: { Args: { search_email: string }; Returns: Json }
      admin_set_user_plan: {
        Args: { new_plan: string; target_email: string }
        Returns: Json
      }
      cleanup_expired_agent_data: { Args: never; Returns: undefined }
      generate_invoice_atomic: {
        Args: {
          p_customer_address: string
          p_customer_email: string
          p_customer_name: string
          p_customer_po_number: string
          p_description: string
          p_due_date: string
          p_invoice_date: string
          p_invoice_number: string
          p_mark_sent: boolean
          p_material_entry_ids: string[]
          p_notes: string
          p_period_end: string
          p_period_start: string
          p_project_id: string
          p_subtotal: number
          p_subtotal_labor: number
          p_subtotal_materials: number
          p_tax_amount: number
          p_time_entry_ids: string[]
          p_total: number
        }
        Returns: string
      }
      generate_rfi_number: { Args: { p_project_id: string }; Returns: string }
      redeem_promo_code: {
        Args: { p_code: string; p_user_id: string }
        Returns: Json
      }
      reset_monthly_permits: { Args: never; Returns: undefined }
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
  public: {
    Enums: {},
  },
} as const
