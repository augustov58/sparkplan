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
          circuit_number: number
          description: string
          breaker_amps: number
          pole: 1 | 2 | 3
          load_watts: number
          conductor_size: string
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          circuit_number: number
          description: string
          breaker_amps: number
          pole: 1 | 2 | 3
          load_watts: number
          conductor_size: string
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          circuit_number?: number
          description?: string
          breaker_amps?: number
          pole?: 1 | 2 | 3
          load_watts?: number
          conductor_size?: string
          created_at?: string
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
