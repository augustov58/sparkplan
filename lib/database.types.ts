/**
 * TypeScript Database Types for Supabase
 * Auto-generated types for type-safe database operations
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          company_name: string | null
          license_number: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          company_name?: string | null
          license_number?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          company_name?: string | null
          license_number?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      projects: {
        Row: {
          id: string
          user_id: string
          name: string
          address: string
          type: 'Residential' | 'Commercial' | 'Industrial'
          nec_edition: '2020' | '2023'
          status: 'Planning' | 'In Progress' | 'Under Review' | 'Compliant'
          progress: number
          service_voltage: number
          service_phase: 1 | 3
          settings: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          address: string
          type: 'Residential' | 'Commercial' | 'Industrial'
          nec_edition: '2020' | '2023'
          status: 'Planning' | 'In Progress' | 'Under Review' | 'Compliant'
          progress?: number
          service_voltage: number
          service_phase: 1 | 3
          settings?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          address?: string
          type?: 'Residential' | 'Commercial' | 'Industrial'
          nec_edition?: '2020' | '2023'
          status?: 'Planning' | 'In Progress' | 'Under Review' | 'Compliant'
          progress?: number
          service_voltage?: number
          service_phase?: 1 | 3
          settings?: Json
          created_at?: string
          updated_at?: string
        }
      }
      loads: {
        Row: {
          id: string
          project_id: string
          description: string
          watts: number
          type: 'lighting' | 'receptacle' | 'motor' | 'hvac' | 'appliance' | 'range' | 'dryer' | 'water_heater'
          continuous: boolean
          phase: 'A' | 'B' | 'C' | '3-Phase'
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          description: string
          watts: number
          type: 'lighting' | 'receptacle' | 'motor' | 'hvac' | 'appliance' | 'range' | 'dryer' | 'water_heater'
          continuous?: boolean
          phase: 'A' | 'B' | 'C' | '3-Phase'
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          description?: string
          watts?: number
          type?: 'lighting' | 'receptacle' | 'motor' | 'hvac' | 'appliance' | 'range' | 'dryer' | 'water_heater'
          continuous?: boolean
          phase?: 'A' | 'B' | 'C' | '3-Phase'
          created_at?: string
        }
      }
      circuits: {
        Row: {
          id: string
          project_id: string
          panel_id: string | null
          circuit_number: number
          description: string
          breaker_amps: number
          pole: 1 | 2 | 3
          load_watts: number
          conductor_size: string
          egc_size: string | null
          load_type: 'L' | 'M' | 'R' | 'O' | 'H' | 'C' | 'W' | 'D' | 'K' | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          panel_id?: string | null
          circuit_number: number
          description: string
          breaker_amps: number
          pole: 1 | 2 | 3
          load_watts: number
          conductor_size: string
          egc_size?: string | null
          load_type?: 'L' | 'M' | 'R' | 'O' | 'H' | 'C' | 'W' | 'D' | 'K' | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          panel_id?: string | null
          circuit_number?: number
          description?: string
          breaker_amps?: number
          pole?: 1 | 2 | 3
          load_watts?: number
          conductor_size?: string
          egc_size?: string | null
          load_type?: 'L' | 'M' | 'R' | 'O' | 'H' | 'C' | 'W' | 'D' | 'K' | null
          created_at?: string
        }
      }
      panels: {
        Row: {
          id: string
          project_id: string
          name: string
          bus_rating: number
          voltage: number
          phase: 1 | 3
          main_breaker_amps: number | null
          location: string | null
          fed_from: string | null
          fed_from_type: 'service' | 'panel' | 'transformer' | null
          fed_from_transformer_id: string | null
          feeder_breaker_amps: number | null
          feeder_conductor_size: string | null
          feeder_conduit: string | null
          feeder_length: number | null
          is_main: boolean
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          name: string
          bus_rating: number
          voltage: number
          phase: 1 | 3
          main_breaker_amps?: number | null
          location?: string | null
          fed_from?: string | null
          fed_from_type?: 'service' | 'panel' | 'transformer' | null
          fed_from_transformer_id?: string | null
          feeder_breaker_amps?: number | null
          feeder_conductor_size?: string | null
          feeder_conduit?: string | null
          feeder_length?: number | null
          is_main?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          name?: string
          bus_rating?: number
          voltage?: number
          phase?: 1 | 3
          main_breaker_amps?: number | null
          location?: string | null
          fed_from?: string | null
          fed_from_type?: 'service' | 'panel' | 'transformer' | null
          fed_from_transformer_id?: string | null
          feeder_breaker_amps?: number | null
          feeder_conductor_size?: string | null
          feeder_conduit?: string | null
          feeder_length?: number | null
          is_main?: boolean
          created_at?: string
        }
      }
      transformers: {
        Row: {
          id: string
          project_id: string
          name: string
          location: string | null
          kva_rating: number
          primary_voltage: number
          primary_phase: 1 | 3
          primary_breaker_amps: number
          primary_conductor_size: string | null
          secondary_voltage: number
          secondary_phase: 1 | 3
          secondary_breaker_amps: number | null
          secondary_conductor_size: string | null
          connection_type: 'delta-wye' | 'wye-wye' | 'delta-delta'
          impedance_percent: number
          fed_from_panel_id: string | null
          manufacturer: string | null
          catalog_number: string | null
          nema_type: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          name: string
          location?: string | null
          kva_rating: number
          primary_voltage: number
          primary_phase: 1 | 3
          primary_breaker_amps: number
          primary_conductor_size?: string | null
          secondary_voltage: number
          secondary_phase: 1 | 3
          secondary_breaker_amps?: number | null
          secondary_conductor_size?: string | null
          connection_type?: 'delta-wye' | 'wye-wye' | 'delta-delta'
          impedance_percent?: number
          fed_from_panel_id?: string | null
          manufacturer?: string | null
          catalog_number?: string | null
          nema_type?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          name?: string
          location?: string | null
          kva_rating?: number
          primary_voltage?: number
          primary_phase?: 1 | 3
          primary_breaker_amps?: number
          primary_conductor_size?: string | null
          secondary_voltage?: number
          secondary_phase?: 1 | 3
          secondary_breaker_amps?: number | null
          secondary_conductor_size?: string | null
          connection_type?: 'delta-wye' | 'wye-wye' | 'delta-delta'
          impedance_percent?: number
          fed_from_panel_id?: string | null
          manufacturer?: string | null
          catalog_number?: string | null
          nema_type?: string | null
          notes?: string | null
          created_at?: string
        }
      }
      feeders: {
        Row: {
          id: string
          project_id: string
          name: string
          source_panel_id: string | null
          destination_panel_id: string | null
          destination_transformer_id: string | null
          distance_ft: number
          conductor_material: 'Cu' | 'Al'
          ambient_temperature_c: number
          num_current_carrying: number
          phase_conductor_size: string | null
          neutral_conductor_size: string | null
          egc_size: string | null
          conduit_size: string | null
          voltage_drop_percent: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          name: string
          source_panel_id?: string | null
          destination_panel_id?: string | null
          destination_transformer_id?: string | null
          distance_ft: number
          conductor_material: 'Cu' | 'Al'
          ambient_temperature_c?: number
          num_current_carrying?: number
          phase_conductor_size?: string | null
          neutral_conductor_size?: string | null
          egc_size?: string | null
          conduit_size?: string | null
          voltage_drop_percent?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          name?: string
          source_panel_id?: string | null
          destination_panel_id?: string | null
          destination_transformer_id?: string | null
          distance_ft?: number
          conductor_material?: 'Cu' | 'Al'
          ambient_temperature_c?: number
          num_current_carrying?: number
          phase_conductor_size?: string | null
          neutral_conductor_size?: string | null
          egc_size?: string | null
          conduit_size?: string | null
          voltage_drop_percent?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      issues: {
        Row: {
          id: string
          project_id: string
          article: string
          description: string
          status: 'Open' | 'Resolved'
          severity: 'Critical' | 'Warning' | 'Info'
          location: string | null
          photo_url: string | null
          assigned_to: string
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          article: string
          description: string
          status: 'Open' | 'Resolved'
          severity: 'Critical' | 'Warning' | 'Info'
          location?: string | null
          photo_url?: string | null
          assigned_to: string
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          article?: string
          description?: string
          status?: 'Open' | 'Resolved'
          severity?: 'Critical' | 'Warning' | 'Info'
          location?: string | null
          photo_url?: string | null
          assigned_to?: string
          created_at?: string
        }
      }
      inspection_items: {
        Row: {
          id: string
          project_id: string
          category: string
          requirement: string
          status: 'Pending' | 'Pass' | 'Fail' | 'N/A'
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          category: string
          requirement: string
          status: 'Pending' | 'Pass' | 'Fail' | 'N/A'
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          category?: string
          requirement?: string
          status?: 'Pending' | 'Pass' | 'Fail' | 'N/A'
          notes?: string | null
          created_at?: string
        }
      }
      grounding_details: {
        Row: {
          id: string
          project_id: string
          electrodes: string[]
          gec_size: string
          bonding: string[]
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          electrodes?: string[]
          gec_size: string
          bonding?: string[]
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          electrodes?: string[]
          gec_size?: string
          bonding?: string[]
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// Export commonly used types for convenience
export type Panel = Database['public']['Tables']['panels']['Row']
export type PanelInsert = Database['public']['Tables']['panels']['Insert']
export type PanelUpdate = Database['public']['Tables']['panels']['Update']

export type Transformer = Database['public']['Tables']['transformers']['Row']
export type TransformerInsert = Database['public']['Tables']['transformers']['Insert']
export type TransformerUpdate = Database['public']['Tables']['transformers']['Update']

export type Feeder = Database['public']['Tables']['feeders']['Row']
export type FeederInsert = Database['public']['Tables']['feeders']['Insert']
export type FeederUpdate = Database['public']['Tables']['feeders']['Update']

export type Circuit = Database['public']['Tables']['circuits']['Row']
export type CircuitInsert = Database['public']['Tables']['circuits']['Insert']
export type CircuitUpdate = Database['public']['Tables']['circuits']['Update']
