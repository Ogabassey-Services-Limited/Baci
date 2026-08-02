Warning: truncated output (original token count: 157174)
Total output lines: 19134

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      agentic_cart_sessions: {
        Row: {
          agent_id: string | null;
          buyer: Json;
          cart_id: string;
          cart_items: Json;
          checkout_session_id: string | null;
          created_at: string;
          currency: string;
          expires_at: string;
          id: string;
          merchant_id: string;
          metadata: Json;
          shipping_address: Json | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          agent_id?: string | null;
          buyer?: Json;
          cart_id: string;
          cart_items?: Json;
          checkout_session_id?: string | null;
          created_at?: string;
          currency?: string;
          expires_at?: string;
          id?: string;
          merchant_id: string;
          metadata?: Json;
          shipping_address?: Json | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          agent_id?: string | null;
          buyer?: Json;
          cart_id?: string;
          cart_items?: Json;
          checkout_session_id?: string | null;
          created_at?: string;
          currency?: string;
          expires_at?: string;
          id?: string;
          merchant_id?: string;
          metadata?: Json;
          shipping_address?: Json | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'agentic_cart_sessions_checkout_session_id_fkey';
            columns: ['checkout_session_id'];
            isOneToOne: false;
            referencedRelation: 'checkout_sessions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'agentic_cart_sessions_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchant_health';
            referencedColumns: ['merchant_id'];
          },
          {
            foreignKeyName: 'agentic_cart_sessions_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'agentic_cart_sessions_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'top_merchants';
            referencedColumns: ['merchant_id'];
          },
        ];
      };
      agentic_idempotency_records: {
        Row: {
          created_at: string;
          expires_at: string;
          id: string;
          idempotency_key: string;
          merchant_id: string;
          request_hash: string;
          response_body: Json | null;
          route: string;
          status_code: number | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          expires_at: string;
          id?: string;
          idempotency_key: string;
          merchant_id: string;
          request_hash: string;
          response_body?: Json | null;
          route: string;
          status_code?: number | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          expires_at?: string;
          id?: string;
          idempotency_key?: string;
          merchant_id?: string;
          request_hash?: string;
          response_body?: Json | null;
          route?: string;
          status_code?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'agentic_idempotency_records_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchant_health';
            referencedColumns: ['merchant_id'];
          },
          {
            foreignKeyName: 'agentic_idempotency_records_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'agentic_idempotency_records_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'top_merchants';
            referencedColumns: ['merchant_id'];
          },
        ];
      };
      agentic_request_records: {
        Row: {
          agent_id: string | null;
          api_version: string;
          created_at: string;
          expires_at: string;
          id: string;
          idempotency_key: string | null;
          merchant_id: string;
          request_id: string;
          route: string | null;
          status_code: number | null;
        };
        Insert: {
          agent_id?: string | null;
          api_version: string;
          created_at?: string;
          expires_at: string;
          id?: string;
          idempotency_key?: string | null;
          merchant_id: string;
          request_id: string;
          route?: string | null;
          status_code?: number | null;
        };
        Update: {
          agent_id?: string | null;
          api_version?: string;
          created_at?: string;
          expires_at?: string;
          id?: string;
          idempotency_key?: string | null;
          merchant_id?: string;
          request_id?: string;
          route?: string | null;
          status_code?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'agentic_request_records_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchant_health';
            referencedColumns: ['merchant_id'];
          },
          {
            foreignKeyName: 'agentic_request_records_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'agentic_request_records_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'top_merchants';
            referencedColumns: ['merchant_id'];
          },
        ];
      };
      ai_generated_topics: {
        Row: {
          created_at: string | null;
          expires_at: string | null;
          generated_post_id: string | null;
          id: string;
          keywords: string[] | null;
          merchant_id: string;
          outline: string | null;
          relevance_score: number | null;
          search_volume_estimate: number | null;
          source: string | null;
          status: string | null;
          title_suggestion: string | null;
          topic: string;
        };
        Insert: {
          created_at?: string | null;
          expires_at?: string | null;
          generated_post_id?: string | null;
          id?: string;
          keywords?: string[] | null;
          merchant_id: string;
          outline?: string | null;
          relevance_score?: number | null;
          search_volume_estimate?: number | null;
          source?: string | null;
          status?: string | null;
          title_suggestion?: string | null;
          topic: string;
        };
        Update: {
          created_at?: string | null;
          expires_at?: string | null;
          generated_post_id?: string | null;
          id?: string;
          keywords?: string[] | null;
          merchant_id?: string;
          outline?: string | null;
          relevance_score?: number | null;
          search_volume_estimate?: number | null;
          source?: string | null;
          status?: string | null;
          title_suggestion?: string | null;
          topic?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'ai_generated_topics_generated_post_id_fkey';
            columns: ['generated_post_id'];
            isOneToOne: false;
            referencedRelation: 'blog_posts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ai_generated_topics_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchant_health';
            referencedColumns: ['merchant_id'];
          },
          {
            foreignKeyName: 'ai_generated_topics_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ai_generated_topics_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'top_merchants';
            referencedColumns: ['merchant_id'];
          },
        ];
      };
      ai_hero_images: {
        Row: {
          category: string;
          created_at: string | null;
          id: string;
          image_prompt: string;
          image_url: string;
          is_active: boolean | null;
          style_variant: string;
          updated_at: string | null;
          usage_count: number | null;
        };
        Insert: {
          category: string;
          created_at?: string | null;
          id?: string;
          image_prompt: string;
          image_url: string;
          is_active?: boolean | null;
          style_variant: string;
          updated_at?: string | null;
          usage_count?: number | null;
        };
        Update: {
          category?: string;
          created_at?: string | null;
          id?: string;
          image_prompt?: string;
          image_url?: string;
          is_active?: boolean | null;
          style_variant?: string;
          updated_at?: string | null;
          usage_count?: number | null;
        };
        Relationships: [];
      };
      ai_jobs: {
        Row: {
          attempts: number;
          completed_at: string | null;
          created_at: string | null;
          error: string | null;
          id: string;
          idempotency_key: string | null;
          input: Json;
          lease_expires_at: string | null;
          locked_at: string | null;
          locked_by: string | null;
          max_attempts: number;
          merchant_id: string;
          metadata: Json;
          model: string | null;
          next_run_at: string;
          output: Json | null;
          result_applied_at: string | null;
          started_at: string | null;
          status: string;
          type: string;
          updated_at: string | null;
        };
        Insert: {
          attempts?: number;
          completed_at?: string | null;
          created_at?: string | null;
          error?: string | null;
          id?: string;
          idempotency_key?: string | null;
          input: Json;
          lease_expires_at?: string | null;
          locked_at?: string | null;
          locked_by?: string | null;
          max_attempts?: number;
          merchant_id: string;
          metadata?: Json;
          model?: string | null;
          next_run_at?: string;
          output?: Json | null;
          result_applied_at?: string | null;
          started_at?: string | null;
          status?: string;
          type: string;
          updated_at?: string | null;
        };
        Update: {
          attempts?: number;
          completed_at?: string | null;
          created_at?: string | null;
          error?: string | null;
          id?: string;
          idempotency_key?: string | null;
          input?: Json;
          lease_expires_at?: string | null;
          locked_at?: string | null;
          locked_by?: string | null;
          max_attempts?: number;
          merchant_id?: string;
          metadata?: Json;
          model?: string | null;
          next_run_at?: string;
          output?: Json | null;
          result_applied_at?: string | null;
          started_at?: string | null;
          status?: string;
          type?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'ai_jobs_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchant_health';
            referencedColumns: ['merchant_id'];
          },
          {
            foreignKeyName: 'ai_jobs_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ai_jobs_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'top_merchants';
            referencedColumns: ['merchant_id'];
          },
        ];
      };
      analytics_events: {
        Row: {
          created_at: string | null;
          embedding: string | null;
          event_data: Json;
          event_id: string | null;
          event_timestamp: string | null;
          event_type: string;
          id: string;
          merchant_id: string;
          source: string | null;
        };
        Insert: {
          created_at?: string | null;
          embedding?: string | null;
          event_data: Json;
          event_id?: string | null;
          event_timestamp?: string | null;
          event_type: string;
          id?: string;
          merchant_id: string;
          source?: string | null;
        };
        Update: {
          created_at?: string | null;
          embedding?: string | null;
          event_data?: Json;
          event_id?: string | null;
          event_timestamp?: string | null;
          event_type?: string;
          id?: string;
          merchant_id?: string;
          source?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'analytics_events_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchant_health';
            referencedColumns: ['merchant_id'];
          },
          {
            foreignKeyName: 'analytics_events_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'analytics_events_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'top_merchants';
            referencedColumns: ['merchant_id'];
          },
        ];
      };
      audit_events: {
        Row: {
          action: string;
          actor_label: string | null;
          actor_type: string;
          actor_user_id: string | null;
          after_values: Json | null;
          before_values: Json | null;
          changed_fields: string[];
          correlation_id: string | null;
          database_transaction_id: string;
          id: string;
          merchant_id: string;
          merchant_label: string | null;
          metadata: Json;
          occurred_at: string;
          request_id: string | null;
          resource_id: string;
          resource_type: string;
          schema_version: number;
          source: string;
        };
        Insert: {
          action: string;
          actor_label?: string | null;
          actor_type: string;
          actor_user_id?: string | null;
          after_values?: Json | null;
          before_values?: Json | null;
          changed_fields?: string[];
          correlation_id?: string | null;
          database_transaction_id: string;
          id?: string;
          merchant_id: string;
          merchant_label?: string | null;
          metadata?: Json;
          occurred_at?: string;
          request_id?: string | null;
          resource_id: string;
          resource_type: string;
          schema_version?: number;
          source: string;
        };
        Update: {
          action?: string;
          actor_label?: string | null;
          actor_type?: string;
          actor_user_id?: string | null;
          after_values?: Json | null;
          before_values?: Json | null;
          changed_fields?: string[];
          correlation_id?: string | null;
          database_transaction_id?: string;
          id?: string;
          merchant_id?: string;
          merchant_label?: string | null;
          metadata?: Json;
          occurred_at?: string;
          request_id?: string | null;
          resource_id?: string;
          resource_type?: string;
          schema_version?: number;
          source?: string;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          action: string;
          changes: Json | null;
          error_message: string | null;
          id: string;
          ip_address: string | null;
          merchant_id: string | null;
          resource_id: string;
          resource_type: string;
          status: string;
          timestamp: string;
          user_agent: string | null;
          user_id: string;
        };
        Insert: {
          action: string;
          changes?: Json | null;
          error_message?: string | null;
          id?: string;
          ip_address?: string | null;
          merchant_id?: string | null;
          resource_id: string;
          resource_type: string;
          status: string;
          timestamp?: string;
          user_agent?: string | null;
          user_id: string;
        };
        Update: {
          action?: string;
          changes?: Json | null;
          error_message?: string | null;
          id?: string;
          ip_address?: string | null;
          merchant_id?: string | null;
          resource_id?: string;
          resource_type?: string;
          status?: string;
          timestamp?: string;
          user_agent?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'audit_logs_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchant_health';
            referencedColumns: ['merchant_id'];
          },
          {
            foreignKeyName: 'audit_logs_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'audit_logs_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'top_merchants';
            referencedColumns: ['merchant_id'];
          },
        ];
      };
      blog_categories: {
        Row: {
          color: string | null;
          created_at: string | null;
          description: string | null;
          icon: string | null;
          id: string;
          merchant_id: string;
          name: string;
          post_count: number | null;
          slug: string;
          updated_at: string | null;
        };
        Insert: {
          color?: string | null;
          created_at?: string | null;
          description?: string | null;
          icon?: string | null;
          id?: string;
          merchant_id: string;
          name: string;
          post_count?: number | null;
          slug: string;
          updated_at?: string | null;
        };
        Update: {
          color?: string | null;
          created_at?: string | null;
          description?: string | null;
          icon?: string | null;
          id?: string;
          merchant_id?: string;
          name?: string;
          post_count?: number | null;
          slug?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'blog_categories_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchant_health';
            referencedColumns: ['merchant_id'];
          },
          {
            foreignKeyName: 'blog_categories_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'blog_categories_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'top_merchants';
            referencedColumns: ['merchant_id'];
          },
        ];
      };
      blog_post_products: {
        Row: {
          blog_post_id: string;
          created_at: string;
          id: string;
          merchant_id: string;
          position: number;
          product_id: string;
          relationship: string;
        };
        Insert: {
          blog_post_id: string;
          created_at?: string;
          id?: string;
          merchant_id: string;
          position: number;
          product_id: string;
          relationship?: string;
        };
        Update: {
          blog_post_id?: string;
          created_at?: string;
          id?: string;
          merchant_id?: string;
          position?: number;
          product_id?: string;
          relationship?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'blog_post_products_blog_post_id_fkey';
            columns: ['blog_post_id'];
            isOneToOne: false;
            referencedRelation: 'blog_posts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'blog_post_products_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchant_health';
            referencedColumns: ['merchant_id'];
          },
          {
            foreignKeyName: 'blog_post_products_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'blog_post_products_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'top_merchants';
            referencedColumns: ['merchant_id'];
          },
          {
            foreignKeyName: 'blog_post_products_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'low_stock_products';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'blog_post_products_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'product_performance';
            referencedColumns: ['product_id'];
          },
          {
            foreignKeyName: 'blog_post_products_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'blog_post_products_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'secure_product_performance';
            referencedColumns: ['product_id'];
          },
        ];
      };
      blog_post_redirects: {
        Row: {
          created_at: string;
          id: string;
          merchant_id: string;
          source_slug: string;
          target_post_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          merchant_id: string;
          source_slug: string;
          target_post_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          merchant_id?: string;
          source_slug?: string;
          target_post_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'blog_post_redirects_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchant_health';
            referencedColumns: ['merchant_id'];
          },
          {
            foreignKeyName: 'blog_post_redirects_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'blog_post_redirects_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'top_merchants';
            referencedColumns: ['merchant_id'];
          },
          {
            foreignKeyName: 'blog_post_redirects_target_post_id_fkey';
            columns: ['target_post_id'];
            isOneToOne: false;
            referencedRelation: 'blog_posts';
            referencedColumns: ['id'];
          },
        ];
      };
      blog_posts: {
        Row: {
          ai_topic_id: string | null;
          author_bio: string | null;
          author_image_url: string | null;
          author_name: string;
          author_title: string | null;
          category: string | null;
          content: string;
          content_embedding: string | null;
          created_at: string | null;
          excerpt: string | null;
          featured_image_alt: string | null;
          featured_image_height: number | null;
          featured_image_url: string | null;
          featured_image_variants: Json;
          featured_image_width: number | null;
          focus_keyword: string | null;
          id: string;
          is_ai_generated: boolean | null;
          is_platform_post: boolean | null;
          keywords: string[] | null;
          merchant_id: string | null;
          published_at: string | null;
          reading_time_minutes: number | null;
          search_vector: unknown;
          seo_description: string | null;
          seo_title: string | null;
          slug: string;
          status: string | null;
          tags: string[] | null;
          title: string;
          updated_at: string | null;
          view_count: number | null;
          word_count: number | null;
        };
        Insert: {
          ai_topic_id?: string | null;
          author_bio?: string | null;
          author_image_url?: string | null;
          author_name: string;
          author_title?: string | null;
          category?: string | null;
          content: string;
          content_embedding?: string | null;
          created_at?: string | null;
          excerpt?: string | null;
          featured_image_alt?: string | null;
          featured_image_height?: number | null;
          featured_image_url?: string | null;
          featured_image_variants?: Json;
          featured_image_width?: number | null;
          focus_keyword?: string | null;
          id?: string;
          is_ai_generated?: boolean | null;
          is_platform_post?: boolean | null;
          keywords?: string[] | null;
          merchant_id?: string | null;
          published_at?: string | null;
          reading_time_minutes?: number | null;
          search_vector?: unknown;
          seo_description?: string | null;
          seo_title?: string | null;
          slug: string;
          status?: string | null;
          tags?: string[] | null;
          title: string;
          updated_at?: string | null;
          view_count?: number | null;
          word_count?: number | null;
        };
        Update: {
          ai_topic_id?: string | null;
          author_bio?: string | null;
          author_image_url?: string | null;
          author_name?: string;
          author_title?: string | null;
          category?: string | null;
          content?: string;
          content_embedding?: string | null;
          created_at?: string | null;
          excerpt?: string | null;
          featured_image_alt?: string | null;
          featured_image_height?: number | null;
          featured_image_url?: string | null;
          featured_image_variants?: Json;
          featured_image_width?: number | null;
          focus_keyword?: string | null;
          id?: string;
          is_ai_generated?: boolean | null;
          is_platform_post?: boolean | null;
          keywords?: string[] | null;
          merchant_id?: string | null;
          published_at?: string | null;
          reading_time_minutes?: number | null;
          search_vector?: unknown;
          seo_description?: string | null;
          seo_title?: string | null;
          slug?: string;
          status?: string | null;
          tags?: string[] | null;
          title?: string;
          updated_at?: string | null;
          view_count?: number | null;
          word_count?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'blog_posts_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchant_health';
            referencedColumns: ['merchant_id'];
          },
          {
            foreignKeyName: 'blog_posts_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'blog_posts_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'top_merchants';
            referencedColumns: ['merchant_id'];
          },
        ];
      };
      branches: {
        Row: {
          active: boolean | null;
          address: string | null;
          city: string | null;
          created_at: string | null;
          id: string;
          is_default: boolean | null;
          manager_id: string | null;
          merchant_id: string;
          name: string;
          phone: string | null;
          state: string | null;
          updated_at: string | null;
        };
        Insert: {
          active?: boolean | null;
          address?: string | null;
          city?: string | null;
          created_at?: string | null;
          id?: string;
          is_default?: boolean | null;
          manager_id?: string | null;
          merchant_id: string;
          name: string;
          phone?: string | null;
          state?: string | null;
          updated_at?: string | null;
        };
        Update: {
          active?: boolean | null;
          address?: string | null;
          city?: string | null;
          created_at?: string | null;
          id?: string;
          is_default?: boolean | null;
          manager_id?: string | null;
          merchant_id?: string;
          name?: string;
          phone?: string | null;
          state?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'branches_manager_id_fkey';
            columns: ['manager_id'];
            isOneToOne: false;
            referencedRelation: 'staff_members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'branches_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchant_health';
            referencedColumns: ['merchant_id'];
          },
          {
            foreignKeyName: 'branches_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'branches_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'top_merchants';
            referencedColumns: ['merchant_id'];
          },
        ];
      };
      brands: {
        Row: {
          created_at: string | null;
          description: string | null;
          display_order: number | null;
          id: string;
          is_active: boolean | null;
          logo_url: string | null;
          merchant_id: string;
          name: string;
          slug: string;
          updated_at: string | null;
          website_url: string | null;
        };
        Insert: {
          created_at?: string | null;
          description?: string | null;
          display_order?: number | null;
          id?: string;
          is_active?: boolean | null;
          logo_url?: string | null;
          merchant_id: string;
          name: string;
          slug: string;
          updated_at?: string | null;
          website_url?: string | null;
        };
        Update: {
          created_at?: string | null;
          description?: string | null;
          display_order?: number | null;
          id?: string;
          is_active?: boolean | null;
          logo_url?: string | null;
          merchant_id?: string;
          name?: string;
          slug?: string;
          updated_at?: string | null;
          website_url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'brands_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchant_health';
            referencedColumns: ['merchant_id'];
          },
          {
            foreignKeyName: 'brands_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'brands_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'top_merchants';
            referencedColumns: ['merchant_id'];
          },
        ];
      };
      byok_fee_accruals: {
        Row: {
          created_at: string;
          currency: string;
          fee_amount: number;
          id: number;
          merchant_id: string;
          order_amount: number;
          order_id: string | null;
          provider: string;
          transaction_reference: string | null;
          waived: boolean;
        };
        Insert: {
          created_at?: string;
          currency: string;
          fee_amount?: number;
          id?: never;
          merchant_id: string;
          order_amount: number;
          order_id?: string | null;
          provider: string;
          transaction_reference?: string | null;
          waived?: boolean;
        };
        Update: {
          created_at?: string;
          currency?: string;
          fee_amount?: number;
          id?: never;
          merchant_id?: string;
          order_amount?: number;
          order_id?: string | null;
          provider?: string;
          transaction_reference?: string | null;
          waived?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'byok_fee_accruals_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchant_health';
            referencedColumns: ['merchant_id'];
          },
          {
            foreignKeyName: 'byok_fee_accruals_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'byok_fee_accruals_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'top_merchants';
            referencedColumns: ['merchant_id'];
          },
        ];
      };
      cache_invalidation_outbox: {
        Row: {
          attempts: number;
          claim_token: string | null;
          claimed_at: string | null;
          claimed_by: string | null;
          claimed_generation: number | null;
          completed_at: string | null;
          completed_generation: number | null;
          created_at: string;
          generation: number;
          last_error_code: string | null;
          max_attempts: number;
          merchant_id: string;
          next_attempt_at: string;
          product_slugs: string[];
          related_identifiers: string[];
          status: string;
          target_id: string;
          target_kind: string;
          updated_at: string;
        };
        Insert: {
          attempts?: number;
          claim_token?: string | null;
          claimed_at?: string | null;
          claimed_by?: string | null;
          claimed_generation?: number | null;
          completed_at?: string | null;
          completed_generation?: number | null;
          created_at?: string;
          generation?: number;
          last_error_code?: string | null;
          max_attempts?: number;
          merchant_id: string;
          next_attempt_at?: string;
          product_slugs?: string[];
          related_identifiers?: string[];
          status?: string;
          target_id: string;
          target_kind: string;
          updated_at?: string;
        };
        Update: {
          attempts?: number;
          claim_token?: string | null;
          claimed_at?: string | null;
          claimed_by?: string | null;
          claimed_generation?: number | null;
          completed_at?: string | null;
          completed_generation?: number | null;
          created_at?: string;
          generation?: number;
          last_error_code?: string | null;
          max_attempts?: number;
          merchant_id?: string;
          next_attempt_at?: string;
          product_slugs?: string[];
          related_identifiers?: string[];
          status?: string;
          target_id?: string;
          target_kind?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          buying_guide_url: string | null;
          created_at: string | null;
          description: string | null;
          display_order: number | null;
          id: string;
          image_url: string | null;
          is_active: boolean | null;
          merchant_id: string;
          metadata: Json | null;
          name: string;
          parent_id: string | null;
          seo_description: string | null;
          seo_faq: Json | null;
          seo_features: Json | null;
          seo_heading: string | null;
          slug: string;
          updated_at: string | null;
        };
        Insert: {
          buying_guide_url?: string | null;
          created_at?: string | null;
          description?: string | null;
          display_order?: number | null;
          id?: string;
          image_url?: string | null;
          is_active?: boolean | null;
          merchant_id: string;
          metadata?: Json | null;
          name: string;
          parent_id?: string | null;
          seo_description?: string | null;
          seo_faq?: Json | null;
          seo_features?: Json | null;
          seo_heading?: string | null;
          slug: string;
          updated_at?: string | null;
        };
        Update: {
          buying_guide_url?: string | null;
          created_at?: string | null;
          description?: string | null;
          display_order?: number | null;
          id?: string;
          image_url?: string | null;
          is_active?: boolean | null;
          merchant_id?: string;
          metadata?: Json | null;
          name?: string;
          parent_id?: string | null;
          seo_description?: string | null;
          seo_faq?: Json | null;
          seo_features?: Json | null;
          seo_heading?: string | null;
          slug?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'categories_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchant_health';
            referencedColumns: ['merchant_id'];
          },
          {
            foreignKeyName: 'categories_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'categories_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'top_merchants';
            referencedColumns: ['merchant_id'];
          },
          {
            foreignKeyName: 'categories_parent_id_fkey';
            columns: ['parent_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
        ];
      };
      chat_orders: {
        Row: {
          created_at: string | null;
          customer_email: string | null;
          customer_name: string | null;
          customer_phone: string | null;
          id: string;
          items: Json;
          merchant_id: string;
          metadata: Json | null;
          paid_at: string | null;
          payment_method: string | null;
          payment_reference: string | null;
          session_id: string | null;
          shipping_address: Json | null;
          shipping_fee: number | null;
          status: string;
          subtotal: number;
          total: number | null;
          updated_at: string | null;
          virtual_account_bank: string | null;
          virtual_account_number: string | null;
        };
        Insert: {
          created_at?: string | null;
          customer_email?: string | null;
          customer_name?: string | null;
          customer_phone?: string | null;
          id?: string;
          items?: Json;
          merchant_id: string;
          metadata?: Json | null;
          paid_at?: string | null;
          payment_method?: string | null;
          payment_reference?: string | null;
          session_id?: string | null;
          shipping_address?: Json | null;
          shipping_fee?: number | null;
          status?: string;
          subtotal?: number;
          total?: number | null;
          updated_at?: string | null;
          virtual_account_bank?: string | null;
          virtual_account_number?: string | null;
        };
        Update: {
          created_at?: string | null;
          customer_email?: string | null;
          customer_name?: string | null;
          customer_phone?: string | null;
          id?: string;
          items?: Json;
          merchant_id?: string;
          metadata?: Json | null;
          paid_at?: string | null;
          payment_method?: string | null;
          payment_reference?: string | null;
          session_id?: string | null;
          shipping_address?: Json | null;
          shipping_fee?: number | null;
          status?: string;
          subtotal?: number;
          total?: number | null;
          updated_at?: string | null;
          virtual_account_bank?: string | null;
          virtual_account_number?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'chat_orders_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchant_health';
            referencedColumns: ['merchant_id'];
          },
          {
            foreignKeyName: 'chat_orders_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'chat_orders_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'top_merchants';
            referencedColumns: ['merchant_id'];
          },
        ];
      };
      checkout_sessions: {
        Row: {
          ad_tracking: Json | null;
          cart_items: Json;
          cart_total: number;
          created_at: string;
          currency: string;
          customer_email: string | null;
          customer_id: string | null;
          customer_name: string | null;
          customer_phone: string | null;
          device_info: Json | null;
          discount_amount: number | null;
          discount_code: string | null;
          expires_at: string;
          id: string;
          merchant_id: string;
          metadata: Json;
          order_id: string | null;
          payment_method: string | null;
          payment_provider: string | null;
          payment_reference: string | null;
          session_id: string;
          shipping_address: Json | null;
          shipping_cost: number | null;
          shipping_method: string | null;
          status: string;
          subtotal: number;
          tax_amount: number | null;
          total_amount: number;
          updated_at: string;
          virtual_account_bank: string | null;
          virtual_account_expires_at: string | null;
          virtual_account_name: string | null;
          virtual_account_number: string | null;
        };
        Insert: {
          ad_tracking?: Json | null;
          cart_items?: Json;
          cart_total?: number;
          created_at?: string;
          currency?: string;
          customer_email?: string | null;
          customer_id?: string | null;
          customer_name?: string | null;
          customer_phone?: string | null;
          device_info?: Json | null;
          discount_amount?: number | null;
          discount_code?: string | null;
          expires_at?: string;
          id?: string;
          merchant_id: string;
          metadata?: Json;
          order_id?: string | null;
          payment_method?: string | null;
          payment_provider?: string | null;
          payment_reference?: string | null;
          session_id: string;
          shipping_address?: Json | null;
          shipping_cost?: number | null;
          shipping_method?: string | null;
          status?: string;
          subtotal?: number;
          tax_amount?: number | null;
          total_amount?: number;
          updated_at?: string;
          virtual_account_bank?: string | null;
          virtual_account_expires_at?: string | null;
          virtual_account_name?: string | null;
          virtual_account_number?: string | null;
        };
        Update: {
          ad_tracking?: Json | null;
          cart_items?: Json;
          cart_total?: number;
          created_at?: string;
          currency?: string;
          customer_email?: string | null;
          customer_id?: string | null;
          customer_name?: string | null;
          customer_phone?: string | null;
          device_info?: Json | null;
          discount_amount?: number | null;
          discount_code?: string | null;
          expires_at?: string;
          id?: string;
          merchant_id?: string;
          metadata?: Json;
          order_id?: string | null;
          payment_method?: string | null;
          payment_provider?: string | null;
          payment_reference?: string | null;
          session_id?: string;
          shipping_address?: Json | null;
          shipping_cost?: number | null;
          shipping_method?: string | null;
          status?: string;
          subtotal?: number;
          tax_amount?: number | null;
          total_amount?: number;
          updated_at?: string;
          virtual_account_bank?: string | null;
          virtual_account_expires_at?: string | null;
          virtual_account_name?: string | null;
          virtual_account_number?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'checkout_sessions_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customer_insights';
            referencedColumns: ['customer_id'];
          },
          {
            foreignKeyName: 'checkout_sessions_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'checkout_sessions_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'priority_winback_customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'checkout_sessions_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'secure_customer_insights';
            referencedColumns: ['customer_id'];
          },
          {
            foreignKeyName: 'checkout_sessions_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchant_health';
            referencedColumns: ['merchant_id'];
          },
          {
            foreignKeyName: 'checkout_sessions_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'checkout_sessions_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'top_merchants';
            referencedColumns: ['merchant_id'];
          },
          {
            foreignKeyName: 'checkout_sessions_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
        ];
      };
      crawler_logs: {
        Row: {
          agent_family: string | null;
          bot_name: string;
          cache_outcome: string | null;
          crawled_at: string | null;
          host: string | null;
          id: string;
          merchant_id: string | null;
          response_time_ms: number | null;
          status_code: number | null;
          url_path: string;
          user_agent: string | null;
        };
        Insert: {
          agent_family?: string | null;
          bot_name: string;
          cache_outcome?: string | null;
          crawled_at?: string | null;
          host?: string | null;
          id?: string;
          merchant_id?: string | null;
          response_time_ms?: number | null;
          status_code?: number | null;
          url_path: string;
          user_agent?: string | null;
        };
        Update: {
          agent_family?: string | null;
          bot_name?: string;
          cache_outcome?: string | null;
          crawled_at?: string | null;
          host?: string | null;
          id?: string;
          merchant_id?: string | null;
          response_time_ms?: number | null;
          status_code?: number | null;
          url_path?: string;
          user_agent?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'crawler_logs_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchant_health';
            referencedColumns: ['merchant_id'];
          },
          {
            foreignKeyName: 'crawler_logs_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'crawler_logs_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'top_merchants';
            referencedColumns: ['merchant_id'];
          },
        ];
      };
      credit_direct_checkout_tokens: {
        Row: {
          consumed_at: string | null;
          created_at: string;
          expires_at: string;
          id: string;
          merchant_id: string;
          order_id: string;
          session_id: string;
          signed_amount: number;
          token_hash: string;
        };
        Insert: {
          consumed_at?: string | null;
          created_at?: string;
          expires_at: string;
          id?: string;
          merchant_id: string;
          order_id: string;
          session_id: string;
          signed_amount: number;
          token_hash: string;
        };
        Update: {
          consumed_at?: string | null;
          created_at?: string;
          expires_at?: string;
          id?: string;
          merchant_id?: string;
          order_id?: string;
          session_id?: string;
          signed_amount?: number;
          token_hash?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'credit_direct_checkout_tokens_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchant_health';
            referencedColumns: ['merchant_id'];
          },
          {
            foreignKeyName: 'credit_direct_checkout_tokens_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'credit_direct_checkout_tokens_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'top_merchants';
            referencedColumns: ['merchant_id'];
          },
          {
            foreignKeyName: 'credit_direct_checkout_tokens_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
        ];
      };
      customer_loyalty: {
        Row: {
          created_at: string | null;
          current_tier: string | null;
          customer_id: string;
          id: string;
          lifetime_points: number | null;
          merchant_id: string;
          points_balance: number | null;
          referral_code: string | null;
          referral_count: number | null;
          referred_by_customer_id: string | null;
          tier_updated_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          current_tier?: string | null;
          customer_id: string;
          id?: string;
          lifetime_points?: number | null;
          merchant_id: string;
          points_balance?: number | null;
          referral_code?: string | null;
          referral_count?: number | null;
          referred_by_customer_id?: string | null;
          tier_updated_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          current_tier?: string | null;
          customer_id?: string;
          id?: string;
          lifetime_points?: number | null;
          merchant_id?: string;
          points_balance?: number | null;
          referral_code?: string | null;
          referral_count?: number | null;
          referred_by_customer_id?: string | null;
          tier_updated_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'customer_loyalty_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customer_insights';
            referencedColumns: ['customer_id'];
          },
          {
            foreignKeyName: 'customer_loyalty_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'customer_loyalty_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'priority_winback_customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'customer_loyalty_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'secure_customer_insights';
            referencedColumns: ['customer_id'];
          },
          {
            foreignKeyName: 'customer_loyalty_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchant_health';
            referencedColumns: ['merchant_id'];
          },
          {
            foreignKeyName: 'customer_loyalty_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'customer_loyalty_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'top_merchants';
            referencedColumns: ['merchant_id'];
          },
          {
            foreignKeyName: 'customer_loyalty_referred_by_customer_id_fkey';
            columns: ['referred_by_customer_id'];
            isOneToOne: false;
            referencedRelation: 'customer_insights';
            referencedColumns: ['customer_id'];
          },
          {
            foreignKeyName: 'customer_loyalty_referred_by_customer_id_fkey';
            columns: ['referred_by_customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'customer_loyalty_referred_by_customer_id_fkey';
            columns: ['referred_by_customer_id'];
            isOneToOne: false;
            referencedRelation: 'priority_winback_customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'customer_loyalty_referred_by_customer_id_fkey';
            columns: ['referred_by_customer_id'];
            isOneToOne: false;
            referencedRelation: 'secure_customer_insights';
            referencedColumns: ['customer_id'];
          },
        ];
      };
      customer_rfm_scores: {
        Row: {
          average_order_value: number | null;
          churn_risk: number | null;
          churn_risk_level: string | null;
          clv_segment: string | null;
          customer_id: string;
          days_since_last_order: number | null;
          first_order_date: string | null;
          frequency_score: number | null;
          id: string;
          last_order_date: string | null;
          lifecycle_segment: string | null;
          merchant_id: string;
          monetary_score: number | null;
          predicted_clv: number | null;
          recency_score: number | null;
          rfm_score: number | null;
          rfm_segment: string | null;
          total_orders: number | null;
          total_spent: number | null;
          updated_at: string | null;
        };
        Insert: {
          average_order_value?: number | null;
          churn_risk?: number | null;
          churn_risk_level?: string | null;
          clv_segment?: string | null;
          customer_id: string;
          days_since_last_order?: number | null;
          first_order_date?: string | null;
          frequency_score?: number | null;
          id?: string;
          last_order_date?: string | null;
          lifecycle_segment?: string | null;
          merchant_id: string;
          monetary_score?: number | null;
          predicted_clv?: number | null;
          recency_score?: number | null;
          rfm_score?: number | null;
          rfm_segment?: string | null;
          total_orders?: number | null;
          total_spent?: number | null;
          updated_at?: string | null;
        };
        Update: {
          average_order_value?: number | null;
          churn_risk?: number | null;
          churn_risk_level?: string | null;
          clv_segment?: string | null;
          customer_id?: string;
          days_since_last_order?: number | null;
          first_order_date?: string | null;
          frequency_score?: number | null;
          id?: string;
          last_order_date?: string | null;
          lifecycle_segment?: string | null;
          merchant_id?: string;
          monetary_score?: number | null;
          predicted_clv?: number | null;
          recency_score?: number | null;
          rfm_score?: number | null;
          rfm_segment?: string | null;
          total_orders?: number | null;
          total_spent?: number | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'customer_rfm_scores_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customer_insights';
            referencedColumns: ['customer_id'];
          },
          {
            foreignKeyName: 'customer_rfm_scores_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'customer_rfm_scores_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'priority_winback_customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'customer_rfm_scores_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'secure_customer_insights';
            referencedColumns: ['customer_id'];
          },
          {
            foreignKeyName: 'customer_rfm_scores_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchant_health';
            referencedColumns: ['merchant_id'];
          },
          {
            foreignKeyName: 'customer_rfm_scores_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'customer_rfm_scores_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'top_merchants';
            referencedColumns: ['merchant_id'];
          },
        ];
      };
      customer_saved_payment_methods: {
        Row: {
          authorization_code: string;
          authorization_data: Json;
          authorization_signature: string;
          bank: string | null;
          brand: string | null;
          card_type: string | null;
          country_code: string | null;
          created_at: string;
          customer_id: string;
          disabled_at: string | null;
          exp_month: string | null;
          exp_year: string | null;
          id: string;
          is_active: boolean;
          is_default: boolean;
          last_used_at: string | null;
          last4: string | null;
          merchant_id: string;
          provider: string;
          provider_customer_email: string;
          reusable: boolean;
          updated_at: string;
        };
        Insert: {
          authorization_code: string;
          authorization_data?: Json;
          authorization_signature: string;
          bank?: string | null;
          brand?: string | null;
          card_type?: string | null;
          country_code?: string | null;
          created_at?: string;
          customer_id: string;
          disabled_at?: string | null;
          exp_month?: string | null;
          exp_year?: string | null;
          id?: string;
          is_active?: boolean;
          is_default?: boolean;
          last_used_at?: string | null;
          last4?: string | null;
          merchant_id: string;
          provider: string;
          provider_customer_email: string;
          reusable?: boolean;
          updated_at?: string;
        };
        Update: {
          authorization_code?: string;
          authorization_data?: Json;
          authorization_signature?: string;
          bank?: string | null;
          brand?: string | null;
          card_type?: string | null;
          country_code?: string | null;
          created_at?: string;
          customer_id?: string;
          disabled_at?: string | null;
          exp_month?: string | null;
          exp_year?: string | null;
          id?: string;
          is_active?: boolean;
          is_default?: boolean;
          last_used_at?: string | null;
          last4?: string | null;
          merchant_id?: string;
          provider?: string;
          provider_customer_email?: string;
          reusable?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'customer_saved_payment_methods_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customer_insights';
            referencedColumns: ['customer_id'];
          },
          {
            foreignKeyName: 'customer_saved_payment_methods_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'customer_saved_payment_methods_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'priority_winback_customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'customer_saved_payment_methods_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'secure_customer_insights';
            referencedColumns: ['customer_id'];
          },
          {
            foreignKeyName: 'customer_saved_payment_methods_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchant_health';
            referencedColumns: ['merchant_id'];
          },
          {
            foreignKeyName: 'customer_saved_payment_methods_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'customer_saved_payment_methods_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'top_merchants';
            referencedColumns: ['merchant_id'];
          },
        ];
      };
      customer_savings_contributions: {
        Row: {
          amount: number;
          created_at: string;
          customer_id: string;
          failed_at: string | null;
          failure_reason: string | null;
          goal_id: string;
          id: string;
          idempotency_key: string;
          merchant_id: string;
          metadata: Json;
          processed_at: string | null;
          saved_payment_method_id: string | null;
          scheduled_for: string | null;
          source_type: string;
          status: string;
          transaction_id: string | null;
          updated_at: string;
          wallet_transaction_id: string | null;
        };
        Insert: {
          amount: number;
          created_at?: string;
          customer_id: string;
          failed_at?: string | null;
          failure_reason?: string | null;
          goal_id: string;
          id?: string;
          idempotency_key: string;
          merchant_id: string;
          metadata?: Json;
          processed_at?: string | null;
          saved_payment_method_id?: string | null;
          scheduled_for?: string | null;
          source_type: string;
          status?: string;
          transaction_id?: string | null;
          updated_at?: string;
          wallet_transaction_id?: string | null;
        };
        Update: {
          amount?: number;
          created_at?: string;
          customer_id?: string;
          failed_at?: string | null;
          failure_reason?: string | null;
          goal_id?: string;
          id?: string;
          idempotency_key?: string;
          merchant_id?: string;
          metadata?: Json;
          processed_at?: string | null;
          saved_payment_method_id?: string | null;
          scheduled_for?: string | null;
          source_type?: string;
          status?: string;
          transaction_id?: string | null;
          updated_at?: string;
          wallet_transaction_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'customer_savings_contributions_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customer_insights';
            referencedColumns: ['customer_id'];
          },
          {
            foreignKeyName: 'customer_savings_contributions_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'customer_savings_contributions_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'priority_winback_customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'customer_savings_contributions_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'secure_customer_insights';
            referencedColumns: ['customer_id'];
          },
          {
            foreignKeyName: 'customer_savings_contributions_goal_id_fkey';
            columns: ['goal_id'];
            isOneToOne: false;
            referencedRelation: 'customer_savings_goals';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'customer_savings_contributions_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchant_health';
            referencedColumns: ['merchant_id'];
          },
          {
            foreignKeyName: 'customer_savings_contributions_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'customer_savings_contributions_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'top_merchants';
            referencedColumns: ['merchant_id'];
          },
          {
            foreignKeyName: 'customer_savings_contributions_saved_payment_method_id_fkey';
            columns: ['saved_payment_method_id'];
            isOneToOne: false;
            referencedRelation: 'customer_saved_payment_methods';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'customer_savings_contributions_transaction_id_fkey';
            columns: ['transaction_id'];
            isOneToOne: false;
            referencedRelation: 'transactions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'customer_savings_contributions_wallet_transaction_id_fkey';
            columns: ['wallet_transaction_id'];
            isOneToOne: false;
            referencedRelation: 'customer_wallet_transactions';
            referencedColumns: ['id'];
          },
        ];
      };
      customer_savings_events: {
        Row: {
          actor_id: string | null;
          actor_type: string;
          created_at: string;
          customer_id: string;
          event_type: string;
          goal_id: string;
          id: string;
          merchant_id: string;
          metadata: Json;
        };
        Insert: {
          actor_id?: string | null;
          actor_type?: string;
          created_at?: string;
          customer_id: string;
          event_type: string;
          goal_id: string;
          id?: string;
          merchant_id: string;
          metadata?: Json;
        };
        Update: {
          actor_id?: string | null;
          actor_type?: string;
          created_at?: string;
          customer_id?: string;
          event_type?: string;
          goal_id?: string;
          id?: string;
          merchant_id?: string;
          metadata?: Json;
        };
        Relationships: [
          {
            foreignKeyName: 'customer_savings_events_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customer_insights';
            referencedColumns: ['customer_id'];
          },
          {
            foreignKeyName: 'customer_savings_events_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'customer_savings_events_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'priority_winback_customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'customer_savings_events_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'secure_customer_insights';
            referencedColumns: ['customer_id'];
          },
          {
            foreignKeyName: 'customer_savings_events_goal_id_fkey';
            columns: ['goal_id'];
            isOneToOne: false;
            referencedRelation: 'customer_savings_goals';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'customer_savings_events_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchant_health';
            referencedColumns: ['merchant_id'];
          },
          {
            foreignKeyName: 'customer_savings_events_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'customer_savings_events_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'top_merchants';
            referencedColumns: ['merchant_id'];
          },
        ];
      };
      customer_savings_goals: {
        Row: {
          applied_order_id: string | null;
          auto_debit_authorized_at: string | null;
          break_fee_percent: number;
          cancelled_at: string | null;
          completed_at: string | null;
          contribution_amount: number;
          contribution_frequency: string;
          created_at: string;
          current_amount: number;
          customer_id: string;
          early_end_fee_accepted_at: string | null;
          future_debits_cancelled_at: string | null;
          id: string;
          initial_contribution_amount: number;
          maturity_date: string;
          merchant_id: string;
          metadata: Json;
          non_withdrawable_accepted_at: string;
          preferred_debit_time: string | null;
          product_id: string;
          product_snapshot: Json;
          saved_payment_method_id: string | null;
          source_mode: string;
          spent_at: string | null;
          start_date: string;
          status: string;
          target_amount: number;
          terms_accepted_at: string;
          title: string;
          updated_at: string;
          variant_id: string | null;
        };
        Insert: {
          applied_order_id?: string | null;
          auto_debit_authorized_at?: string | null;
          break_fee_percent?: number;
          cancelled_at?: string | null;
          completed_at?: string | null;
          contribution_amount: number;
          contribution_frequency: string;
          created_at?: string;
          current_amount?: number;
          customer_id: string;
          early_end_fee_accepted_at?: string | null;
          future_debits_cancelled_at?: string | null;
          id?: string;
          initial_contribution_amount?: number;
          maturity_date: string;
          merchant_id: string;
          metadata?: Json;
          non_withdrawable_accepted_at: string;
          preferred_debit_time?: string | null;
          product_id: string;
          product_snapshot?: Json;
          saved_payment_method_id?: string | null;
          source_mode: string;
          spent_at?: string | null;
          start_date: string;
          status?: string;
          target_amount: number;
          terms_accepted_at: string;
          title: string;
          updated_at?: string;
          variant_id?: string | null;
        };
        Update: {
          applied_order_id?: string | null;
          auto_debit_authorized_at?: string | null;
          break_fee_percent?: number;
          cancelled_at?: string | null;
          completed_at?: string | null;
          contribution_amount?: number;
          contribution_frequency?: string;
          created_at?: string;
          current_amount?: number;
          customer_id?: string;
          early_end_fee_accepted_at?: string | null;
          future_debits_cancelled_at?: string | null;
          id?: string;
          initial_contribution_amount?: number;
          maturity_date?: string;
          merchant_id?: string;
          metadata?: Json;
          non_withdrawable_accepted_at?: string;
          preferred_debit_time?: string | null;
          product_id?: string;
          product_snapshot?: Json;
          saved_payment_method_id?: string | null;
          source_mode?: string;
          spent_at?: string | null;
          start_date?: string;
          status?: string;
          target_amount?: number;
          terms_accepted_at?: string;
          title?: string;
          updated_at?: string;
          variant_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'customer_savings_goals_applied_order_id_fkey';
            columns: ['applied_order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'customer_savings_goals_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customer_insights';
            referencedColumns: ['customer_id'];
          },
          {
            foreignKeyName: 'customer_savings_goals_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'customer_savings_goals_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'priority_winback_customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'customer_savings_goals_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'secure_customer_insights';
            referencedColumns: ['customer_id'];
          },
          {
            foreignKeyName: 'customer_savings_goals_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchant_health';
            referencedColumns: ['merchant_id'];
          },
          {
            foreignKeyName: 'customer_savings_goals_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'customer_savings_goals_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'top_merchants';
            referencedColumns: ['merchant_id'];
          },
          {
            foreignKeyName: 'customer_savings_goals_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'low_stock_products';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'customer_savings_goals_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'product_performance';
            referencedColumns: ['product_id'];
          },
          {
            foreignKeyName: 'customer_savings_goals_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'customer_savings_goals_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'secure_product_performance';
            referencedColumns: ['product_id'];
          },
          {
            foreignKeyName: 'customer_savings_goals_saved_payment_method_id_fkey';
            columns: ['saved_payment_method_id'];
            isOneToOne: false;
            referencedRelation: 'customer_saved_payment_methods';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'customer_savings_goals_variant_id_fkey';
            columns: ['variant_id'];
            isOneToOne: false;
            referencedRelation: 'product_variants';
            referencedColumns: ['id'];
          },
        ];
      };
      customer_savings_redemptions: {
        Row: {
          amount: number;
          created_at: string;
          customer_id: string;
          goal_id: string;
          id: string;
          idempotency_key: string;
          merchant_id: string;
          metadata: Json;
          order_id: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          customer_id: string;
          goal_id: string;
          id?: string;
          idempotency_key: string;
          merchant_id: string;
          metadata?: Json;
          order_id: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          customer_id?: string;
          goal_id?: string;
          id?: string;
          idempotency_key?: string;
          merchant_id?: string;
          metadata?: Json;
          order_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'customer_savings_redemptions_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customer_insights';
            referencedColumns: ['customer_id'];
          },
          {
            foreignKeyName: 'customer_savings_redemptions_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'customer_savings_redemptions_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'priority_winback_customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'customer_savings_redemptions_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'secure_customer_insights';
            referencedColumns: ['customer_id'];
          },
          {
            foreignKeyName: 'customer_savings_redemptions_goal_id_fkey';
            columns: ['goal_id'];
            isOneToOne: false;
            referencedRelation: 'customer_savings_goals';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'customer_savings_redemptions_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchant_health';
            referencedColumns: ['merchant_id'];
          },
          {
            foreignKeyName: 'customer_savings_redemptions_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'customer_savings_redemptions_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'top_merchants';
            referencedColumns: ['merchant_id'];
          },
          {
            foreignKeyName: 'customer_savings_redemptions_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
        ];
      };
      customer_wallet_account_transactions: {
        Row: {
          account_id: string;
          amount: number;
          balance_after: number;
          created_at: string;
          currency: string;
          customer_id: string;
          description: string | null;
          id: string;
          merchant_id: string;
          metadata: Json;
          source_id: string;
          source_type: string;
          type: string;
        };
        Insert: {
          account_id: string;
          amount: number;
          balance_after: number;
          created_at?: string;
          currency: string;
          customer_id: string;
          description?: string | null;
          id?: string;
          merchant_id: string;
          metadata?: Json;
          source_id: string;
          source_type: string;
          type: string;
        };
        Update: {
          account_id?: string;
          amount?: number;
          balance_after?: number;
          created_at?: string;
          currency?: string;
          customer_id?: string;
          description?: string | null;
          id?: string;
          merchant_id?: string;
          metadata?: Json;
          source_id?: string;
          source_type?: string;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'customer_wallet_account_transactions_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'customer_wallet_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'customer_wallet_account_transactions_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customer_insights';
            referencedColumns: ['customer_id'];
          },
          {
            foreignKeyName: 'customer_wallet_account_transactions_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'customer_wallet_account_transactions_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'priority_winback_customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'customer_wallet_account_transactions_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'secure_customer_insights';
            referencedColumns: ['customer_id'];
          },
          {
            foreignKeyName: 'customer_wallet_account_transactions_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchant_health';
            referencedColumns: ['merchant_id'];
          },
          {
            foreignKeyName: 'customer_wallet_account_transactions_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'customer_wallet_account_transactions_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'top_merchants';
            referencedColumns: ['merchant_id'];
          },
        ];
      };
      customer_wallet_accounts: {
        Row: {
          available_balance: number;
          created_at: string;
          currency: string;
          customer_id: string;
          id: string;
          merchant_id: string;
          total_credited: number;
          total_debited: number;
          updated_at: string;
        };
        Insert: {
          available_balance?: number;
          created_at?: string;
          currency: string;
          customer_id: string;
          id?: string;
          merchant_id: string;
          total_credited?: number;
          total_debited?: number;
          updated_at?: string;
        };
        Update: {
          available_balance?: number;
          created_at?: string;
          currency?: string;
          customer_id?: string;
          id?: string;
          merchant_id?: string;
          total_credited?: number;
          total_debited?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'customer_wallet_accounts_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customer_insights';
            referencedColumns: ['customer_id'];
          },
          {
            foreignKeyName: 'customer_wallet_accounts_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'customer_wallet_accounts_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'priority_winback_customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'customer_wallet_accounts_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'secure_customer_insights';
            referencedColumns: ['customer_id'];
          },
          {
            foreignKeyName: 'customer_wallet_accounts_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchant_health';
            referencedColumns: ['merchant_id'];
          },
          {
            foreignKeyName: 'customer_wallet_accounts_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'customer_wallet_accounts_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'top_merchants';
            referencedColumns: ['merchant_id'];
          },
        ];
      };
      customer_wallet_payment_accounts: {
        Row: {
          account_name: string;
          account_number: string;
          bank_name: string;
          bank_slug: string | null;
          consented_at: string;
          created_at: string;
          currency: string;
          customer_id: string;
          id: string;
          merchant_id: string;
          metadata: Json;
          provider: string;
          provider_account_id: string | null;
          provider_customer_code: string;
          provider_subaccount_code: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          account_name: string;
          account_number: string;
          bank_name: string;
          bank_slug?: string | null;
          consented_at: string;
          created_at?: string;
          currency?: string;
          customer_id: string;
          id?: string;
          merchant_id: string;
          metadata?: Json;
          provider?: string;
          provider_account_id?: string | null;
          provider_customer_code: string;
          provider_subaccount_code: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          account_name?: string;
          account_number?: string;
          bank_name?: string;
          bank_slug?: string | null;
          consented_at?: string;
          created_at?: string;
          currency?: string;
          customer_id?: string;
          id?: string;
          merchant_id?: string;
          metadata?: Json;
          provider?: string;
          provider_account_id?: string | null;
          provider_customer_code?: string;
          provider_subaccount_code?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'customer_wallet_payment_accounts_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customer_insights';
            referencedColumns: ['customer_id'];
          },
          {
            foreignKeyName: 'customer_wallet_payment_accounts_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'customer_wallet_payment_accounts_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'priority_winback_customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'customer_wallet_payment_accounts_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'secure_customer_insights';
            referencedColumns: ['customer_id'];
          },
          {
            foreignKeyName: 'customer_wallet_payment_accounts_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchant_health';
            referencedColumns: ['merchant_id'];
          },
          {
            foreignKeyName: 'customer_wallet_payment_accounts_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'customer_wallet_payment_accounts_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'top_merchants';
            referencedColumns: ['merchant_id'];
          },
        ];
      };
      customer_wallet_transactions: {
        Row: {
          amount: number;
          balance_after: number;
          created_at: string | null;
          customer_id: string;
          description: string | null;
          id: string;
          merchant_id: string;
          metadata: Json | null;
          source_id: string | null;
          source_type: string | null;
          status: string | null;
          type: string;
          wallet_id: string;
        };
        Insert: {
          amount: number;
          balance_after: number;
          created_at?: string | null;
          customer_id: string;
          description?: string | null;
          id?: string;
          merchant_id: string;
          metadata?: Json | null;
          source_id?: string | null;
          source_type?: string | null;
          status?: string | null;
          type: string;
          wallet_id: string;
        };
        Update: {
          amount?: number;
          balance_after?: number;
          created_at?: string | null;
          customer_id?: string;
          description?: string | null;
          id?: string;
          merchant_id?: string;
          metadata?: Json | null;
          source_id?: string | null;
          source_type?: string | null;
          status?: string | null;
          type?: string;
          wallet_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'customer_wallet_transactions_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customer_insights';
            referencedColumns: ['customer_id'];
          },
          {
            foreignKeyName: 'customer_wallet_transactions_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'customer_wallet_transactions_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'priority_winback_customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'customer_wallet_transactions_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'secure_customer_insights';
            referencedColumns: ['customer_id'];
          },
          {
            foreignKeyName: 'customer_wallet_transactions_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchant_health';
            referencedColumns: ['merchant_id'];
          },
          {
            foreignKeyName: 'customer_wallet_transactions_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'customer_wallet_transactions_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'top_merchants';
            referencedColumns: ['merchant_id'];
          },
          {
            foreignKeyName: 'customer_wallet_transactions_wallet_id_fkey';
            columns: ['wallet_id'];
            isOneToOne: false;
            referencedRelation: 'customer_wallets';
            referencedColumns: ['id'];
          },
        ];
      };
      customer_wallets: {
        Row: {
          available_balance: number | null;
…107174 tokens truncated…;
      };
      create_recovery_code_set: {
        Args: { p_code_hashes: string[]; p_user_id: string };
        Returns: string;
      };
      create_repair_booking: {
        Args: {
          p_customer_email: string;
          p_customer_name: string;
          p_customer_phone: string;
          p_device_id?: string;
          p_device_model: string;
          p_device_type: string;
          p_issue_description: string;
          p_merchant_id: string;
          p_pickup_address?: string;
          p_preferred_date?: string;
          p_quote_id?: string;
          p_service_type?: string;
        };
        Returns: {
          id: string;
          ticket_number: number;
        }[];
      };
      create_storefront_order: {
        Args: {
          p_ad_tracking?: Json;
          p_checkout_idempotency_key?: string;
          p_checkout_request_hash?: string;
          p_customer_email: string;
          p_customer_name: string;
          p_customer_phone?: string;
          p_discount_amount?: number;
          p_expected_total?: number;
          p_gift_wrapping_fee?: number;
          p_items: Json;
          p_merchant_id: string;
          p_notes?: string;
          p_payment_method?: string;
          p_payment_status?: string;
          p_selected_quote_id?: string;
          p_shipping_address?: Json;
          p_shipping_fee?: number;
          p_shipping_provider?: string;
          p_shipping_status?: string;
          p_source?: string;
          p_tax_amount?: number;
          p_tax_basis?: string;
          p_tracking_number?: string;
          p_user_id?: string;
        };
        Returns: {
          customer_email: string;
          customer_id: string;
          customer_name: string;
          customer_phone: string;
          discount_amount: number;
          gift_wrapping_fee: number;
          id: string;
          idempotency_replayed: boolean;
          merchant_id: string;
          order_number: string;
          payment_method: string;
          payment_status: string;
          shipping_address: Json;
          shipping_fee: number;
          shipping_status: string;
          subtotal: number;
          tax_amount: number;
          tax_basis: string;
          total: number;
          tracking_token: string;
        }[];
      };
      create_storefront_order_with_discount_code: {
        Args: {
          p_ad_tracking?: Json;
          p_checkout_idempotency_key?: string;
          p_checkout_request_hash?: string;
          p_customer_email: string;
          p_customer_name: string;
          p_customer_phone?: string;
          p_discount_amount?: number;
          p_discount_code_id?: string;
          p_expected_total?: number;
          p_gift_wrapping_fee?: number;
          p_items: Json;
          p_merchant_id: string;
          p_notes?: string;
          p_payment_method?: string;
          p_payment_status?: string;
          p_selected_quote_id?: string;
          p_shipping_address?: Json;
          p_shipping_fee?: number;
          p_shipping_provider?: string;
          p_shipping_status?: string;
          p_source?: string;
          p_tax_amount?: number;
          p_tax_basis?: string;
          p_tracking_number?: string;
          p_user_id?: string;
        };
        Returns: {
          customer_email: string;
          customer_id: string;
          customer_name: string;
          customer_phone: string;
          discount_amount: number;
          gift_wrapping_fee: number;
          id: string;
          idempotency_replayed: boolean;
          merchant_id: string;
          order_number: string;
          payment_method: string;
          payment_status: string;
          shipping_address: Json;
          shipping_fee: number;
          shipping_status: string;
          subtotal: number;
          tax_amount: number;
          tax_basis: string;
          total: number;
          tracking_token: string;
        }[];
      };
      create_storefront_order_with_quiz_voucher: {
        Args: {
          p_ad_tracking?: Json;
          p_customer_email: string;
          p_customer_name: string;
          p_customer_phone?: string;
          p_discount_amount?: number;
          p_expected_total?: number;
          p_gift_wrapping_fee?: number;
          p_items: Json;
          p_merchant_id: string;
          p_notes?: string;
          p_payment_method?: string;
          p_payment_status?: string;
          p_route_proof?: Json;
          p_selected_quote_id?: string;
          p_shipping_address?: Json;
          p_shipping_fee?: number;
          p_shipping_provider?: string;
          p_shipping_status?: string;
          p_source?: string;
          p_tax_amount?: number;
          p_tax_basis?: string;
          p_tracking_number?: string;
          p_user_id?: string;
        };
        Returns: {
          customer_email: string;
          customer_id: string;
          customer_name: string;
          customer_phone: string;
          discount_amount: number;
          gift_wrapping_fee: number;
          id: string;
          merchant_id: string;
          order_number: string;
          payment_method: string;
          payment_status: string;
          shipping_address: Json;
          shipping_fee: number;
          shipping_status: string;
          subtotal: number;
          tax_amount: number;
          tax_basis: string;
          total: number;
          tracking_token: string;
        }[];
      };
      create_storefront_order_with_savings: {
        Args: {
          p_ad_tracking?: Json;
          p_checkout_idempotency_key?: string;
          p_checkout_request_hash?: string;
          p_customer_email: string;
          p_customer_name: string;
          p_customer_phone?: string;
          p_discount_amount?: number;
          p_expected_total?: number;
          p_gift_wrapping_fee?: number;
          p_items: Json;
          p_merchant_id: string;
          p_notes?: string;
          p_payment_method?: string;
          p_payment_status?: string;
          p_savings_amount?: number;
          p_savings_goal_id?: string;
          p_savings_idempotency_key?: string;
          p_selected_quote_id?: string;
          p_shipping_address?: Json;
          p_shipping_fee?: number;
          p_shipping_provider?: string;
          p_shipping_status?: string;
          p_source?: string;
          p_tax_amount?: number;
          p_tax_basis?: string;
          p_tracking_number?: string;
          p_user_id?: string;
        };
        Returns: {
          customer_email: string;
          customer_id: string;
          customer_name: string;
          customer_phone: string;
          discount_amount: number;
          gift_wrapping_fee: number;
          id: string;
          idempotency_replayed: boolean;
          merchant_id: string;
          order_number: string;
          payment_method: string;
          payment_status: string;
          savings_goal_id: string;
          savings_goal_status: string;
          savings_redeemed_amount: number;
          savings_redemption_id: string;
          savings_redemption_success: boolean;
          shipping_address: Json;
          shipping_fee: number;
          shipping_status: string;
          subtotal: number;
          tax_amount: number;
          tax_basis: string;
          total: number;
          tracking_token: string;
        }[];
      };
      credit_customer_wallet: {
        Args: {
          p_amount: number;
          p_customer_id: string;
          p_description?: string;
          p_merchant_id: string;
          p_source_id: string;
          p_source_type: string;
        };
        Returns: {
          new_balance: number;
          success: boolean;
          transaction_id: string;
        }[];
      };
      credit_customer_wallet_account: {
        Args: {
          p_amount: number;
          p_currency: string;
          p_customer_id: string;
          p_description?: string;
          p_merchant_id: string;
          p_source_id: string;
          p_source_type: string;
        };
        Returns: {
          currency: string;
          new_balance: number;
          success: boolean;
          transaction_id: string;
        }[];
      };
      credit_merchant_wallet: {
        Args: {
          p_amount: number;
          p_description?: string;
          p_merchant_id: string;
          p_source_id: string;
          p_source_type: string;
        };
        Returns: {
          new_balance: number;
          transaction_id: string;
          wallet_id: string;
        }[];
      };
      current_agentic_merchant_id: { Args: never; Returns: string };
      current_agentic_session_id: { Args: never; Returns: string };
      customer_order_can_cancel: {
        Args: { p_order_id: string };
        Returns: boolean;
      };
      deactivate_branch: {
        Args: { p_branch_id: string };
        Returns: {
          active: boolean | null;
          address: string | null;
          city: string | null;
          created_at: string | null;
          id: string;
          is_default: boolean | null;
          manager_id: string | null;
          merchant_id: string;
          name: string;
          phone: string | null;
          state: string | null;
          updated_at: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'branches';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      dead_letter_ingress_event_v1: {
        Args: {
          p_domain_event_id: string;
          p_failure_code: string;
          p_failure_message: string;
          p_original_envelope: Json;
          p_parser_version?: number;
          p_queue_message_id: number;
        };
        Returns: string;
      };
      debit_merchant_wallet: {
        Args: {
          p_amount: number;
          p_description?: string;
          p_merchant_id: string;
          p_type: string;
        };
        Returns: {
          error_message: string;
          new_balance: number;
          success: boolean;
          transaction_id: string;
          wallet_id: string;
        }[];
      };
      decrement_product_stock: {
        Args: { product_id_param: string; quantity_param: number };
        Returns: {
          message: string;
          new_stock: number;
          success: boolean;
        }[];
      };
      decrement_variant_stock: {
        Args: { quantity_param: number; variant_id_param: string };
        Returns: {
          message: string;
          new_stock: number;
          success: boolean;
        }[];
      };
      delete_current_storefront_account: { Args: never; Returns: undefined };
      delete_merchant_payment_credential: {
        Args: { p_merchant_id: string; p_provider: string };
        Returns: undefined;
      };
      delete_merchant_payment_credential_role: {
        Args: {
          p_credential_role: string;
          p_environment: string;
          p_merchant_id: string;
          p_provider: string;
        };
        Returns: undefined;
      };
      delete_variant_inventory_unit: {
        Args: { p_merchant_id: string; p_unit_id: string };
        Returns: Json;
      };
      encode_base32_crockford: { Args: { num: number }; Returns: string };
      enqueue_cache_invalidation_target: {
        Args: {
          p_merchant_id: string;
          p_product_slugs?: string[];
          p_related_identifiers?: string[];
          p_target_id: string;
          p_target_kind: string;
        };
        Returns: undefined;
      };
      enqueue_domain_event_v1: {
        Args: {
          p_causation_id?: string;
          p_changed_fields?: string[];
          p_correlation_id?: string;
          p_data: Json;
          p_event_name: string;
          p_external_event_id: string;
          p_idempotency_key: string;
          p_merchant_id: string;
          p_metadata: Json;
          p_occurred_at?: string;
          p_producer: string;
          p_source: Json;
          p_subject_id: string;
          p_subject_type: string;
          p_trust_level: string;
        };
        Returns: {
          already_enqueued: boolean;
          domain_event_id: string;
          queue_message_id: number;
        }[];
      };
      enqueue_storefront_cache_targets: {
        Args: {
          p_additional_hostname?: string;
          p_additional_slug?: string;
          p_merchant_id: string;
          p_product_slugs?: string[];
        };
        Returns: undefined;
      };
      enqueue_storefront_product_cache_target: {
        Args: { p_merchant_id: string; p_product_identifier: string };
        Returns: undefined;
      };
      expire_order_wallet_funding_intents: {
        Args: {
          p_customer_id?: string;
          p_merchant_id?: string;
          p_now?: string;
          p_wallet_payment_account_id?: string;
        };
        Returns: undefined;
      };
      extract_primary_image_from_jsonb: {
        Args: { p_images: Json };
        Returns: string;
      };
      extract_variant_color: { Args: { p_attributes: Json }; Returns: string };
      extract_variant_color_key: {
        Args: { p_attributes: Json };
        Returns: string;
      };
      fail_customer_savings_authorization_transaction: {
        Args: {
          p_customer_id: string;
          p_failure_message: string;
          p_merchant_id: string;
          p_reference: string;
        };
        Returns: boolean;
      };
      fail_petrock_remediation_before_acceptance: {
        Args: {
          p_customer_message: string;
          p_order_id: string;
          p_reason: string;
        };
        Returns: boolean;
      };
      file_wallet_order_funding_ambiguous_review: {
        Args: {
          p_gateway_reference: string;
          p_intent_ids: string[];
          p_reason?: string;
        };
        Returns: undefined;
      };
      finalize_due_quiz_events: { Args: never; Returns: number };
      finalize_petrock_imei_lookup: {
        Args: {
          p_cached_response: Json;
          p_cached_status: number;
          p_lease_token?: string;
          p_lookup_id: string;
          p_provider_status: string;
          p_response_hash?: string;
          p_terminal_status: string;
        };
        Returns: boolean;
      };
      finalize_petrock_remediation_order: {
        Args: {
          p_customer_message: string;
          p_failure_reason?: string;
          p_order_id: string;
          p_provider_status: string;
          p_success: boolean;
        };
        Returns: boolean;
      };
      finalize_quiz_awards: {
        Args: {
          p_attempt_id: string;
          p_event_id: string;
          p_server_proof?: Json;
          p_user_id?: string;
        };
        Returns: number;
      };
      finalize_quiz_event_awards: {
        Args: {
          p_event_id: string;
          p_production_approved?: boolean;
          p_route_proof?: Json;
        };
        Returns: number;
      };
      finalize_quiz_voucher_order_payment: {
        Args: { p_award_id: string; p_order_id: string };
        Returns: boolean;
      };
      finalize_store_credit_order_payment: {
        Args: {
          p_amount: number;
          p_order_id: string;
          p_payment_method: string;
        };
        Returns: boolean;
      };
      finalize_wallet_funded_order: {
        Args: {
          p_currency?: string;
          p_gateway_fee?: number;
          p_gateway_reference: string;
          p_intent_id: string;
          p_paid_at?: string;
          p_received_amount: number;
          p_transaction_id: string;
        };
        Returns: {
          credited_amount: number;
          debited_amount: number;
          excess_amount: number;
          funded_amount: number;
          order_id: string;
          order_paid: boolean;
          order_payment_transaction_id: string;
          wallet_credit_transaction_id: string;
          wallet_debit_transaction_id: string;
        }[];
      };
      finalize_wallet_order_payment: {
        Args: { p_amount: number; p_order_id: string };
        Returns: boolean;
      };
      find_nearest_shipping_service_centres: {
        Args: {
          p_latitude: number;
          p_limit?: number;
          p_longitude: number;
          p_provider: string;
        };
        Returns: {
          address: string;
          distance_metres: number;
          latitude: number;
          longitude: number;
          service_centre_code: string;
          service_centre_id: number;
          service_centre_name: string;
          source_synced_at: string;
          station_code: string;
          station_id: number;
          station_name: string;
        }[];
      };
      find_product_search_suggestion_v2: {
        Args: {
          merchant_id_param: string;
          search_term: string;
          similarity_threshold?: number;
        };
        Returns: {
          similarity_score: number;
          suggested_term: string;
        };
      };
      find_spelling_suggestion: {
        Args: {
          merchant_id_param: string;
          search_term: string;
          similarity_threshold?: number;
        };
        Returns: {
          similarity_score: number;
          suggested_term: string;
        }[];
      };
      finish_cache_invalidation: {
        Args: {
          p_claim_token: string;
          p_error_code?: string;
          p_generation: number;
          p_merchant_id: string;
          p_retry_after_seconds?: number;
          p_succeeded: boolean;
          p_target_id: string;
          p_target_kind: string;
        };
        Returns: boolean;
      };
      finish_event_delivery_v1: {
        Args: {
          p_available_at?: string;
          p_claim_token: string;
          p_delivery_id: string;
          p_error_code?: string;
          p_error_message?: string;
          p_http_status?: number;
          p_outcome: string;
          p_provider_response_id?: string;
        };
        Returns: boolean;
      };
      finish_manual_payment_side_effect: {
        Args: {
          p_claim_token: string;
          p_error: string;
          p_status: string;
          p_step: string;
          p_transaction_id: string;
        };
        Returns: boolean;
      };
      finish_order_cancellation_side_effect: {
        Args: {
          p_claim_token: string;
          p_error?: string;
          p_order_id: string;
          p_result?: Json;
          p_status: string;
          p_step: string;
        };
        Returns: boolean;
      };
      format_merchant_address: { Args: { p_address: Json }; Returns: string };
      format_order_item_variant_name: {
        Args: { p_attributes: Json };
        Returns: string;
      };
      generate_improved_order_number: {
        Args: { merchant_uuid: string };
        Returns: string;
      };
      generate_inventory_snapshot: {
        Args: { p_merchant_id: string };
        Returns: number;
      };
      generate_order_number_for_merchant: {
        Args: { merchant_uuid: string };
        Returns: string;
      };
      generate_slug: { Args: { text_input: string }; Returns: string };
      get_active_banners: {
        Args: { p_merchant_id: string };
        Returns: {
          action_label: string;
          action_url: string;
          created_at: string;
          id: string;
          message: string;
          notification_id: string;
          notification_type: string;
          priority: string;
          title: string;
        }[];
      };
      get_admin_merchant_health: {
        Args: never;
        Returns: {
          active_days: number;
          business_name: string;
          email: string;
          health_status: string;
          joined_at: string;
          last_order_date: string;
          merchant_id: string;
          storefront_slug: string;
          total_gmv: number;
          total_orders: number;
        }[];
      };
      get_admin_merchant_profiles: { Args: never; Returns: Json };
      get_admin_platform_daily_summary: {
        Args: { p_end_date?: string; p_start_date?: string };
        Returns: {
          active_merchants: number;
          avg_gmv_per_merchant: number;
          platform_gmv: number;
          sale_date: string;
          total_customers: number;
          total_orders: number;
        }[];
      };
      get_admin_platform_growth: {
        Args: { p_limit?: number };
        Returns: {
          month: string;
          new_merchants: number;
        }[];
      };
      get_admin_top_merchants: {
        Args: never;
        Returns: {
          avg_daily_revenue: number;
          business_name: string;
          joined_at: string;
          merchant_id: string;
          total_gmv: number;
          total_orders: number;
        }[];
      };
      get_agentic_action_health_records: {
        Args: { p_merchant_id: string; p_record_limit?: number };
        Returns: Json;
      };
      get_analytics_summary: {
        Args: {
          p_end_date: string;
          p_merchant_id: string;
          p_start_date: string;
        };
        Returns: Json;
      };
      get_checkout_shipping_quote: {
        Args: { p_merchant_id: string; p_quote_id: string };
        Returns: {
          expires_at: string;
          merchant_id: string;
          price: number;
          provider: string;
          provider_rate_id: string;
          quote_request: Json;
        }[];
      };
      get_credit_direct_settings: {
        Args: { p_merchant_slug: string };
        Returns: {
          credit_direct_enabled: boolean;
          credit_direct_max_amount: number;
          credit_direct_min_amount: number;
          credit_direct_public_key: string;
          merchant_id: string;
          merchant_slug: string;
        }[];
      };
      get_customer_savings_feature_settings: {
        Args: { p_customer_id: string; p_merchant_id: string };
        Returns: {
          customer_device_savings_auto_debit_enabled: boolean;
          customer_device_savings_enabled: boolean;
          paystack_enabled: boolean;
        }[];
      };
      get_customer_wallet_dva_enabled: {
        Args: { p_customer_id: string; p_merchant_id: string };
        Returns: boolean;
      };
      get_domain_event_queue_metrics_v1: {
        Args: never;
        Returns: {
          measured_at: string;
          newest_message_age_seconds: number;
          oldest_message_age_seconds: number;
          queue_length: number;
          total_messages: number;
        }[];
      };
      get_effective_inventory_tracking_policy: {
        Args: { p_product_policy: string; p_variant_policy: string };
        Returns: string;
      };
      get_event_pipeline_operations_v1: { Args: never; Returns: Json };
      get_feed_product_variants: {
        Args: { p_merchant_id: string; p_product_ids: string[] };
        Returns: {
          attributes: Json;
          condition: string;
          id: string;
          price_override: number;
          product_id: string;
          sku: string;
          stock_quantity: number;
        }[];
      };
      get_fulfillment_items_array: {
        Args: { p_fulfillment: Json };
        Returns: Json;
      };
      get_merchant_balance: {
        Args: { currency_param: string; merchant_id_param: string };
        Returns: number;
      };
      get_merchant_id_for_user: {
        Args: { user_uuid: string };
        Returns: string;
      };
      get_merchant_identity_verified: {
        Args: { p_merchant_id: string };
        Returns: boolean;
      };
      get_merchant_inventory_stats: {
        Args: { p_merchant_id: string };
        Returns: Json;
      };
      get_merchant_payment_credential_ciphertext: {
        Args: {
          p_credential_role: string;
          p_environment: string;
          p_merchant_id: string;
          p_provider: string;
        };
        Returns: {
          ciphertext: string;
          kek_version: number;
        }[];
      };
      get_merchant_payment_credential_meta: {
        Args: { p_merchant_id: string; p_provider: string };
        Returns: {
          credential_role: string;
          disabled_at: string;
          environment: string;
          is_active: boolean;
          key_last4: string;
          last_validated_at: string;
          last_validation_error: string;
        }[];
      };
      get_merchant_paystack_subaccount_code: {
        Args: { p_merchant_id: string };
        Returns: string;
      };
      get_merchant_paystack_subaccount_configured: {
        Args: { p_merchant_id: string };
        Returns: boolean;
      };
      get_merchant_product_count: {
        Args: { merchant_id_param: string };
        Returns: number;
      };
      get_merchant_product_slug_resolution: {
        Args: { p_merchant_id: string; p_product_slug: string };
        Returns: {
          present: boolean;
          redirect_category: string;
          redirect_category_id: string;
          redirect_category_name: string;
          redirect_category_parent_id: string;
          redirect_category_slug: string;
          redirect_product_id: string;
          redirect_product_name: string;
          redirect_product_slug: string;
        }[];
      };
      get_merchant_product_slug_set: {
        Args: { p_merchant_id: string };
        Returns: string[];
      };
      get_merchant_push_tokens: {
        Args: { p_merchant_id: string };
        Returns: {
          device_name: string;
          platform: string;
          token: string;
        }[];
      };
      get_merchant_signup_policy_health: { Args: never; Returns: Json };
      get_merchant_signup_policy_health_pre_mobile_v2: {
        Args: never;
        Returns: Json;
      };
      get_merchant_verification_flags: {
        Args: { p_merchant_id: string };
        Returns: Json;
      };
      get_merchant_verification_status: {
        Args: { p_merchant_id: string };
        Returns: Json;
      };
      get_merchant_virtual_terminal_code: {
        Args: { p_merchant_id: string };
        Returns: string;
      };
      get_missing_index_suggestions: {
        Args: never;
        Returns: {
          columns: string;
          constraint_name: string;
          suggested_index: string;
          table_name: string;
        }[];
      };
      get_mobile_admin_dashboard_stats: {
        Args: {
          p_branch_id?: string;
          p_merchant_id: string;
          p_previous_end_at?: string;
          p_previous_start_at?: string;
          p_start_at?: string;
        };
        Returns: Json;
      };
      get_mobile_admin_order_counts: {
        Args: { p_branch_id?: string; p_merchant_id: string };
        Returns: Json;
      };
      get_mobile_admin_revenue_chart: {
        Args: { p_branch_id?: string; p_buckets: Json; p_merchant_id: string };
        Returns: Json;
      };
      get_monthly_sales_stats: {
        Args: { p_merchant_id: string };
        Returns: Json;
      };
      get_notification_stats: {
        Args: { p_notification_id: string };
        Returns: {
          read_rate: number;
          total_dismissed: number;
          total_read: number;
          total_sent: number;
        }[];
      };
      get_or_create_customer_wallet: {
        Args: { p_customer_id: string; p_merchant_id: string };
        Returns: string;
      };
      get_or_create_merchant_wallet: {
        Args: { p_merchant_id: string };
        Returns: string;
      };
      get_order_notification_outbox_manual_terminal_status: {
        Args: {
          p_event_type: string;
          p_merchant_id: string;
          p_order_id: string;
        };
        Returns: string;
      };
      get_order_payment_snapshot: {
        Args: { p_email: string; p_order_id: string };
        Returns: {
          currency: string;
          merchant_country: string;
          merchant_id: string;
          payment_status: string;
          shipping_status: string;
          total: number;
          tracking_token: string;
        }[];
      };
      get_order_receipt_bank_details: {
        Args: { p_order_id: string; p_tracking_token?: string };
        Returns: {
          bank_account_name: string;
          bank_account_number: string;
          bank_code: string;
          bank_name: string;
          brand_colors: Json;
          business_address: string;
          business_name: string;
          cac_rc_number: string;
          email: string;
          legal_entity_name: string;
          logo_url: string;
          pages: Json;
          phone: string;
          rider_phone_number: string;
          social_media: Json;
          support_email: string;
          support_phone: string;
          tax_identification_number: string;
          vat_rate: number;
          vat_registration_status: string;
        }[];
      };
      get_order_tracking: {
        Args: {
          p_email?: string;
          p_merchant_slug: string;
          p_order_id?: string;
          p_order_number?: string;
          p_tracking_token?: string;
        };
        Returns: {
          cancelled_at: string;
          created_at: string;
          currency: string;
          customer_email: string;
          customer_name: string;
          customer_phone: string;
          delivered_at: string;
          discount_amount: number;
          id: string;
          items: Json;
          merchant_business_name: string;
          merchant_id: string;
          merchant_logo_url: string;
          merchant_phone: string;
          merchant_slug: string;
          merchant_support_email: string;
          merchant_support_phone: string;
          order_number: string;
          paid_at: string;
          payment_status: string;
          shipped_at: string;
          shipping_address: Json;
          shipping_cost: number;
          shipping_provider: string;
          shipping_status: string;
          subtotal: number;
          total: number;
          tracking_number: string;
          updated_at: string;
        }[];
      };
      get_order_variant_overrides: {
        Args: { p_variant_ids: string[] };
        Returns: {
          id: string;
          price_override: number;
          product_id: string;
        }[];
      };
      get_pending_provider_shipment_cancellation_finalization: {
        Args: { p_merchant_id: string; p_shipment_id: string };
        Returns: Json;
      };
      get_platform_analytics_summary: {
        Args: { p_end_date: string; p_start_date: string };
        Returns: Json;
      };
      get_product_offers: {
        Args: { p_product_id: string };
        Returns: {
          compare_at_price: number;
          condition: string;
          condition_notes: string;
          grade: string;
          images: Json;
          offer_id: string;
          price: number;
          stock_quantity: number;
        }[];
      };
      get_product_rating_stats: {
        Args: { p_product_id: string };
        Returns: {
          average_rating: number;
          rating_distribution: Json;
          review_count: number;
        }[];
      };
      get_public_blog_categories: {
        Args: { p_merchant_id: string };
        Returns: {
          category: string;
        }[];
      };
      get_public_serialized_variant_availability_counts: {
        Args: {
          p_branch_id?: string;
          p_merchant_id: string;
          p_product_ids: string[];
        };
        Returns: {
          product_id: string;
          public_available_units: number;
          variant_id: string;
        }[];
      };
      get_push_token_stats: {
        Args: never;
        Returns: {
          active_count: number;
          app_type: string;
          platform: string;
          total_count: number;
        }[];
      };
      get_quiz_event_question_counts: {
        Args: { p_event_ids: string[] };
        Returns: {
          event_id: string;
          question_count: number;
        }[];
      };
      get_quiz_leaderboard: {
        Args: { p_event_id: string };
        Returns: {
          attempt_id: string;
          customer_id: string;
          customer_name: string;
          is_current_customer: boolean;
          rank: number;
          score: number;
          status: string;
          submitted_at: string;
          total_time_seconds: number;
        }[];
      };
      get_quiz_leaderboard_public: {
        Args: { p_event_id: string };
        Returns: {
          customer_name: string;
          is_current_customer: boolean;
          rank: number;
          score: number;
          status: string;
          submitted_at: string;
          total_time_seconds: number;
        }[];
      };
      get_receipt_claim_campaign_stats: {
        Args: { p_import_job_id: string; p_merchant_id: string };
        Returns: Json;
      };
      get_record_payment_order_transactions: {
        Args: { p_merchant_id: string; p_order_id: string };
        Returns: {
          amount: number;
          error_code: string;
          gateway: string;
          gateway_reference: string;
          status: string;
        }[];
      };
      get_repair_status: {
        Args: {
          p_email: string;
          p_merchant_id: string;
          p_ticket_number: number;
        };
        Returns: {
          created_at: string;
          device_model: string;
          device_type: string;
          repair_type_label: string;
          service_type: string;
          status: Database['public']['Enums']['repair_status'];
          ticket_number: number;
          tracking_number: string;
          updated_at: string;
        }[];
      };
      get_sales_by_channel: {
        Args: {
          p_end_date: string;
          p_merchant_id: string;
          p_start_date: string;
        };
        Returns: Json;
      };
      get_sales_by_payment_method: {
        Args: {
          p_end_date: string;
          p_merchant_id: string;
          p_start_date: string;
        };
        Returns: Json;
      };
      get_sales_dashboard_stats: {
        Args: { p_merchant_id: string };
        Returns: Json;
      };
      get_social_proof_stats: {
        Args: { p_merchant_id: string; p_product_id: string };
        Returns: Json;
      };
      get_staff_invite_preview: {
        Args: { p_token: string };
        Returns: {
          email: string;
          invitation_expires_at: string;
          merchant_business_name: string;
          merchant_slug: string;
          role: Database['public']['Enums']['staff_role'];
          status: string;
        }[];
      };
      get_staff_permissions: { Args: { p_staff_id: string }; Returns: Json };
      get_storefront_blog_listing_status: {
        Args: { p_author_name: string; p_identifier: string };
        Returns: {
          author_count: number;
          blog_enabled: boolean;
          categories: string[];
          category_counts: number[];
          storefront_status: string;
          total_count: number;
        }[];
      };
      get_storefront_blog_post_status: {
        Args: { p_identifier: string; p_post_slug: string };
        Returns: {
          blog_enabled: boolean;
          live_present: boolean;
          redirect_target_slug: string;
          storefront_status: string;
        }[];
      };
      get_storefront_category_slug_state: {
        Args: { p_merchant_id: string; p_slug: string };
        Returns: {
          is_active: boolean;
        }[];
      };
      get_storefront_cluster_guide_candidates_v1: {
        Args: {
          p_category_slug: string;
          p_cluster_rules: Json;
          p_limit?: number;
          p_merchant_id: string;
          p_search_query: string;
        };
        Returns: {
          category: string;
          excerpt: string;
          featured_image_url: string;
          keywords: string[];
          published_at: string;
          reading_time_minutes: number;
          slug: string;
          tags: string[];
          title: string;
        }[];
      };
      get_storefront_discount_code: {
        Args: {
          p_code: string;
          p_include_inactive?: boolean;
          p_merchant_id: string;
        };
        Returns: {
          applies_to: string;
          category_ids: Json;
          code: string;
          description: string;
          discount_type: string;
          discount_value: number;
          expires_at: string;
          id: string;
          is_active: boolean;
          maximum_discount_amount: number;
          minimum_purchase_amount: number;
          product_ids: Json;
          starts_at: string;
          usage_count: number;
          usage_limit: number;
          usage_limit_per_customer: number;
        }[];
      };
      get_storefront_order_quote_validation_context: {
        Args: {
          p_customer_email: string;
          p_has_selected_quote_id?: boolean;
          p_merchant_id: string;
          p_order_id: string;
          p_selected_quote_id?: string;
          p_tracking_token: string;
        };
        Returns: {
          order_items: Json;
          selected_quote_id: string;
          shipping_address: Json;
          shipping_fee: number;
          shipping_provider: string;
        }[];
      };
      get_storefront_payment_settings: {
        Args: { p_merchant_id: string };
        Returns: {
          credit_direct_enabled: boolean;
          credpal_enabled: boolean;
          juicyway_enabled: boolean;
          klump_enabled: boolean;
          klump_max_amount: number;
          klump_min_amount: number;
          korapay_enabled: boolean;
          pay_on_delivery_enabled: boolean;
          paystack_enabled: boolean;
          vat_rate: number;
          vat_registration_status: string;
          wallet_order_auto_debit_enabled: boolean;
          wallet_paystack_dva_enabled: boolean;
        }[];
      };
      get_storefront_pdp_core_v2: {
        Args: {
          p_branch_id?: string;
          p_merchant_id: string;
          p_product_slug: string;
        };
        Returns: {
          product_data: Json;
          resolution_status: string;
        }[];
      };
      get_storefront_pdp_preflight: {
        Args: { p_identifier: string; p_product_slug: string };
        Returns: {
          catalog_nonempty: boolean;
          category_id: string;
          category_name: string;
          category_slug: string;
          match_kind: string;
          present: boolean;
          product_category: string;
          product_id: string;
          product_name: string;
          product_slug: string;
          storefront_status: string;
        }[];
      };
      get_storefront_pdp_semantic_enrichment_v1: {
        Args: {
          p_category_slug: string;
          p_cluster_guide_limit?: number;
          p_cluster_rules: Json;
          p_include_guides?: boolean;
          p_inventory_limit?: number;
          p_merchant_id: string;
          p_product_guide_limit?: number;
          p_product_id: string;
          p_search_query: string;
        };
        Returns: {
          cluster_guide_data: Json;
          inventory_data: Json;
          product_guide_data: Json;
          resolution_status: string;
        };
      };
      get_storefront_product_variants: {
        Args: { p_product_ids: string[] };
        Returns: {
          attributes: Json;
          condition: string;
          created_at: string;
          id: string;
          images: Json;
          price_override: number;
          primary_image: string;
          product_id: string;
          sku: string;
          stock_quantity: number;
          updated_at: string;
        }[];
      };
      get_storefront_receipt_merchant_info: {
        Args: { p_slug: string };
        Returns: {
          bank_account_name: string;
          bank_account_number: string;
          bank_code: string;
          bank_name: string;
          brand_colors: Json;
          business_address: string;
          business_name: string;
          cac_rc_number: string;
          email: string;
          legal_entity_name: string;
          logo_url: string;
          pages: Json;
          phone: string;
          rider_phone_number: string;
          social_media: Json;
          support_email: string;
          support_phone: string;
          tax_identification_number: string;
          vat_rate: number;
          vat_registration_status: string;
        }[];
      };
      get_storefront_shipping_rates: {
        Args: { p_merchant_id: string };
        Returns: Json;
      };
      get_storefront_vtu_settings: {
        Args: { p_merchant_id: string };
        Returns: {
          vtu_airtime_enabled: boolean;
          vtu_betting_enabled: boolean;
          vtu_data_enabled: boolean;
          vtu_electricity_enabled: boolean;
          vtu_enabled: boolean;
          vtu_tv_enabled: boolean;
        }[];
      };
      get_supplier_purchase_analytics: {
        Args: {
          p_branch_id?: string;
          p_end_date?: string;
          p_merchant_id: string;
          p_start_date?: string;
        };
        Returns: {
          gross_profit: number;
          loss_unit_count: number;
          missing_cost_unit_count: number;
          order_count: number;
          supplier_name: string;
          total_cost: number;
          total_revenue: number;
          unit_count: number;
        }[];
      };
      get_top_products: {
        Args: {
          p_branch_id?: string;
          p_end_date: string;
          p_limit?: number;
          p_merchant_id: string;
          p_start_date: string;
        };
        Returns: Json;
      };
      get_total_sales: { Args: never; Returns: number };
      get_unread_notification_count: {
        Args: { p_merchant_id: string };
        Returns: number;
      };
      get_user_access: {
        Args: never;
        Returns: {
          is_owner: boolean;
          is_staff: boolean;
          merchant_id: string;
          permissions: Json;
          role: string;
        }[];
      };
      get_user_merchant_access: {
        Args: { p_user_id: string };
        Returns: {
          is_owner: boolean;
          merchant_id: string;
          merchant_name: string;
          permissions: Json;
          role: Database['public']['Enums']['staff_role'];
        }[];
      };
      get_user_merchant_context: { Args: never; Returns: Json };
      get_wallet_summary: {
        Args: { p_merchant_id: string };
        Returns: {
          available_balance: number;
          can_withdraw: boolean;
          next_settlement_amount: number;
          next_settlement_date: string;
          pending_balance: number;
          total_earned: number;
          total_withdrawn: number;
          upcoming_balance: number;
          upcoming_count: number;
          wallet_id: string;
        }[];
      };
      get_website_performance_event_summary: {
        Args: {
          p_end_date: string;
          p_merchant_id: string;
          p_start_date: string;
        };
        Returns: Json;
      };
      has_cache_invalidation_dead_letters: { Args: never; Returns: boolean };
      has_merchant_access: {
        Args: { p_merchant_id: string };
        Returns: boolean;
      };
      immutable_unaccent: { Args: { search_text: string }; Returns: string };
      increment_blog_post_views: {
        Args: { p_post_id: string };
        Returns: undefined;
      };
      increment_hero_image_usage: {
        Args: { image_id: string };
        Returns: undefined;
      };
      invoke_cleanup_pending_transactions: { Args: never; Returns: undefined };
      is_active_staff_of: {
        Args: { p_merchant_id: string; p_user_id: string };
        Returns: boolean;
      };
      is_agentic_checkout_context: { Args: never; Returns: boolean };
      is_customer_username_available: {
        Args: { p_merchant_id: string; p_username: string };
        Returns: boolean;
      };
      is_event_ingress_capability_v1: {
        Args: {
          p_event_id: string;
          p_event_name: string;
          p_event_timestamp: string;
          p_event_type: string;
          p_kind: string;
          p_merchant_id: string;
          p_producer: string;
          p_source: string;
          p_trust_level: string;
        };
        Returns: boolean;
      };
      is_reserved_merchant_slug: { Args: { p_slug: string }; Returns: boolean };
      is_staff_of_merchant: {
        Args: { p_merchant_id: string };
        Returns: boolean;
      };
      is_valid_email: { Args: { email_text: string }; Returns: boolean };
      is_valid_username_format: {
        Args: { p_username: string };
        Returns: boolean;
      };
      issue_credit_direct_checkout_token: {
        Args: {
          p_email: string;
          p_merchant_id: string;
          p_order_id: string;
          p_session_id: string;
          p_tracking_token: string;
        };
        Returns: {
          checkout_token: string;
          expires_at: string;
          signed_amount: number;
        }[];
      };
      link_transaction_order_item_product: {
        Args: {
          p_merchant_id: string;
          p_order_item_id: string;
          p_product_id: string;
          p_variant_id: string;
        };
        Returns: undefined;
      };
      list_event_pipeline_deliveries_v1: {
        Args: {
          p_destination?: string;
          p_error_code?: string;
          p_from?: string;
          p_limit?: number;
          p_merchant_id?: string;
          p_offset?: number;
          p_status: string;
          p_to?: string;
        };
        Returns: Json;
      };
      list_event_pipeline_ingress_failures_v1: {
        Args: {
          p_error_code?: string;
          p_from?: string;
          p_limit?: number;
          p_merchant_id?: string;
          p_offset?: number;
          p_to?: string;
        };
        Returns: Json;
      };
      list_merchant_audit_events_v1: {
        Args: {
          p_action?: string;
          p_before_id?: string;
          p_before_occurred_at?: string;
          p_limit: number;
          p_merchant_id: string;
          p_resource_type?: string;
        };
        Returns: {
          action: string;
          actor_label: string;
          actor_type: string;
          actor_user_id: string;
          after_values: Json;
          before_values: Json;
          changed_fields: string[];
          correlation_id: string;
          database_transaction_id: string;
          id: string;
          merchant_id: string;
          merchant_label: string;
          metadata: Json;
          occurred_at: string;
          request_id: string;
          resource_id: string;
          resource_type: string;
          schema_version: number;
          source: string;
        }[];
      };
      list_variant_inventory_units: {
        Args: {
          p_branch_id?: string;
          p_branch_scope?: string;
          p_cursor_created_at?: string;
          p_cursor_id?: string;
          p_limit?: number;
          p_merchant_id: string;
          p_product_id: string;
          p_status?: string;
          p_variant_id?: string;
        };
        Returns: Json;
      };
      mark_abandoned_orders: {
        Args: { hours_threshold?: number };
        Returns: undefined;
      };
      mark_customer_savings_redemptions_reversed: {
        Args: { p_merchant_id: string; p_order_id: string; p_reason: string };
        Returns: number;
      };
      mark_merchant_payment_credential_invalid: {
        Args: {
          p_credential_role: string;
          p_environment: string;
          p_error: string;
          p_merchant_id: string;
          p_provider: string;
        };
        Returns: undefined;
      };
      mark_order_inventory_units_sold: {
        Args: { p_merchant_id: string; p_order_id: string };
        Returns: Json;
      };
      mark_order_payment_failed_and_release_inventory: {
        Args: {
          p_merchant_id: string;
          p_notes?: string;
          p_order_id: string;
          p_payment_status: string;
          p_shipping_address?: Json;
        };
        Returns: Json;
      };
      mark_paypal_transaction_refunded: {
        Args: {
          p_pending_refund_ids?: string[];
          p_restore_prepaid_on_reconcile?: boolean;
          p_status: string;
          p_transaction_id: string;
        };
        Returns: boolean;
      };
      mark_petrock_imei_submission_unknown: {
        Args: {
          p_lease_token?: string;
          p_lookup_id: string;
          p_order_id?: string;
          p_provider_status: string;
        };
        Returns: boolean;
      };
      mark_petrock_remediation_submission_unknown: {
        Args: {
          p_order_id: string;
          p_provider_order_id?: string;
          p_reason: string;
        };
        Returns: boolean;
      };
      mark_transaction_order_item_custom: {
        Args: { p_merchant_id: string; p_order_item_id: string };
        Returns: undefined;
      };
      mark_wallet_funding_intents_review_required: {
        Args: {
          p_gateway_reference: string;
          p_intent_ids: string[];
          p_reason: string;
        };
        Returns: undefined;
      };
      match_blog_to_product: {
        Args: {
          match_count?: number;
          match_threshold?: number;
          merchant_id_filter: string;
          product_embedding: string;
        };
        Returns: {
          category: string;
          excerpt: string;
          featured_image_url: string;
          id: string;
          reading_time_minutes: number;
          similarity: number;
          slug: string;
          title: string;
        }[];
      };
      mutate_merchant_blog_post_with_product_links: {
        Args: {
          p_merchant_id: string;
          p_post_data: Json;
          p_post_id: string | null;
          p_product_ids?: string[] | null;
        };
        Returns: {
          category: string | null;
          content: string;
          excerpt: string | null;
          featured_image_url: string | null;
          id: string;
          merchant_id: string;
          published_at: string | null;
          slug: string;
          status: string;
          title: string;
        }[];
      };
      merchant_feature_settings_public_cache_projection: {
        Args: {
          p_settings: Database['public']['Tables']['merchant_feature_settings']['Row'];
        };
        Returns: Json;
      };
      mint_quiz_event_ranked_awards: {
        Args: { p_event_id: string };
        Returns: number;
      };
      normalize_inventory_identifier: {
        Args: { p_value: string };
        Returns: string;
      };
      normalize_product_search_text: {
        Args: { search_text: string };
        Returns: string;
      };
      normalize_variant_axis_value: {
        Args: { p_value: string };
        Returns: string;
      };
      pause_customer_savings_goal: {
        Args: {
          p_actor_id?: string;
          p_customer_id: string;
          p_goal_id: string;
          p_merchant_id: string;
        };
        Returns: {
          goal_status: string;
          success: boolean;
        }[];
      };
      petrock_model_scope_matches: {
        Args: { p_device_model: string; p_model_scope: Json };
        Returns: boolean;
      };
      prepare_order_notification_outbox_manual_send: {
        Args: {
          p_courier_name?: string;
          p_estimated_delivery?: string;
          p_event_type: string;
          p_merchant_id: string;
          p_order_id: string;
          p_tracking_number?: string;
        };
        Returns: Json;
      };
      prepare_petrock_remediation_order: {
        Args: {
          p_customer_id: string;
          p_fx_rate: number;
          p_merchant_id: string;
          p_order_id: string;
          p_payment_currency: string;
          p_product_id: string;
        };
        Returns: {
          amount_ngn: number | null;
          amount_usdt: number | null;
          carrier: string | null;
          completed_at: string | null;
          cost_usd: number | null;
          created_at: string;
          customer_id: string;
          customer_message: string | null;
          device_model: string | null;
          eligibility_checks_completed: string[];
          eligibility_evidence: Json;
          eligibility_next_check: string | null;
          email_notification_claim_token: string | null;
          email_notification_claim_until: string | null;
          email_notified_at: string | null;
          failure_reason: string | null;
          feedback_token_hash: string | null;
          fx_rate_used: number | null;
          id: string;
          identifier_ciphertext: string | null;
          identifier_hash: string;
          in_app_notified_at: string | null;
          merchant_id: string;
          next_poll_at: string | null;
          paid_at: string | null;
          payment_currency: string | null;
          provider_attempt_started_at: string | null;
          provider_order_id: string | null;
          provider_reference_id: string | null;
          provider_status: string | null;
          push_notification_claim_token: string | null;
          push_notification_claim_until: string | null;
          push_notified_at: string | null;
          reconcile_attempts: number;
          reconcile_lease_token: string | null;
          reconcile_lease_until: string | null;
          refund_policy: string | null;
          refunded_at: string | null;
          remediation_product_id: string | null;
          source_lookup_id: string;
          status: string;
          status_segment: string | null;
          submitted_at: string | null;
          success_rate: number | null;
          turnaround: string | null;
          updated_at: string;
        }[];
        SetofOptions: {
          from: '*';
          to: 'petrock_orders';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      prepare_storefront_order_for_checkout: {
        Args: {
          p_customer_email: string;
          p_has_selected_quote_id?: boolean;
          p_merchant_id: string;
          p_order_id: string;
          p_payment_method: string;
          p_selected_quote_id?: string;
          p_shipping_address?: Json;
          p_shipping_provider?: string;
          p_tracking_token: string;
        };
        Returns: {
          currency: string;
          id: string;
          order_number: string;
          payment_method: string;
          payment_status: string;
          shipping_fee: number;
          shipping_status: string;
          subtotal: number;
          total: number;
          tracking_token: string;
        }[];
      };
      preview_receipt_claim: { Args: { p_token_hash: string }; Returns: Json };
      process_due_settlements: {
        Args: never;
        Returns: {
          details: Json;
          processed_count: number;
          total_amount: number;
        }[];
      };
      product_autocomplete:
        | {
            Args: {
              merchant_id_param: string;
              result_limit?: number;
              search_prefix: string;
            };
            Returns: {
              category: string;
              id: string;
              image_small: string;
              name: string;
              price: number;
            }[];
          }
        | {
            Args: {
              merchant_id_param: string;
              result_limit?: number;
              search_prefix: string;
            };
            Returns: {
              category: string;
              id: string;
              image_small: string;
              name: string;
              price: number;
            }[];
          };
      product_autocomplete_v2: {
        Args: {
          merchant_id_param: string;
          result_limit?: number;
          search_prefix: string;
        };
        Returns: {
          category: string;
          id: string;
          image_small: string;
          name: string;
          price: number;
          relevance: number;
          slug: string;
        }[];
      };
      product_search_vector_v2: {
        Args: {
          product_brand: string;
          product_category: string;
          product_description: string;
          product_name: string;
          product_sku: string;
        };
        Returns: unknown;
      };
      provision_mobile_merchant_v2: {
        Args: {
          p_brand_colors: Json;
          p_business_name: string;
          p_business_type: string;
          p_country: string;
          p_first_name: string;
          p_last_name: string;
          p_logo_url: string;
          p_other_business_type: string;
          p_phone: string;
          p_signup_source: string;
          p_slug: string;
          p_slug_is_custom: boolean;
        };
        Returns: {
          created: boolean;
          merchant_id: string;
          merchant_slug: string;
        }[];
      };
      quiz_answer_key_hash: { Args: { p_answer: string }; Returns: string };
      quiz_answer_key_matches: {
        Args: { p_answer: string; p_answer_key_hash: string };
        Returns: boolean;
      };
      quiz_bind_attempt_device_internal: {
        Args: {
          p_attempt_id: string;
          p_device_hash: string;
          p_user_id: string;
        };
        Returns: boolean;
      };
      quiz_compare_signatures: {
        Args: { p_left: string; p_right: string };
        Returns: boolean;
      };
      quiz_device_cap_ready: { Args: never; Returns: boolean };
      quiz_device_proof_subject: {
        Args: { p_device_hash: string; p_scope_id: string };
        Returns: string;
      };
      quiz_event_max_attempts: {
        Args: { p_event_id: string };
        Returns: number;
      };
      quiz_free_entry_ready: { Args: never; Returns: boolean };
      quiz_log_route_proof_failure: {
        Args: { p_reason: string; p_route_proof: Json };
        Returns: boolean;
      };
      quiz_normalize_answer_key: {
        Args: { p_answer: string };
        Returns: string;
      };
      quiz_normalize_email: { Args: { p_email: string }; Returns: string };
      quiz_route_proof_valid:
        | { Args: { p_route_proof: Json }; Returns: boolean }
        | {
            Args: {
              p_expected_action?: string;
              p_expected_subject_id?: string;
              p_expected_user_id?: string;
              p_route_proof: Json;
            };
            Returns: boolean;
          };
      quiz_rpc_server_secret_configured: { Args: never; Returns: boolean };
      read_domain_events_v1: {
        Args: {
          p_batch_size?: number;
          p_max_poll_seconds?: number;
          p_visibility_timeout_seconds?: number;
        };
        Returns: {
          enqueued_at: string;
          message: Json;
          msg_id: number;
          read_ct: number;
          visible_at: string;
        }[];
      };
      rebuild_sku_matrix_product_projection: {
        Args: { p_product_id: string };
        Returns: undefined;
      };
      rebuild_sku_matrix_products: {
        Args: { p_product_ids: string[] };
        Returns: undefined;
      };
      record_analytics_domain_event_v1: {
        Args: {
          p_delivery_data: Json;
          p_domain_event_data: Json;
          p_event_data: Json;
          p_event_name: string;
          p_event_timestamp: string;
          p_event_type: string;
          p_external_event_id: string;
          p_merchant_id: string;
          p_metadata?: Json;
          p_producer: string;
          p_source: string;
          p_trust_level: string;
        };
        Returns: {
          already_enqueued: boolean;
          domain_event_id: string;
          queue_message_id: number;
        }[];
      };
      record_bvn_verification: {
        Args: {
          p_bvn: string;
          p_date_of_birth: string;
          p_first_name: string;
          p_last_name: string;
          p_merchant_id: string;
        };
        Returns: undefined;
      };
      record_cac_verification: {
        Args: {
          p_cac_approved_name: string;
          p_cac_certificate_path: string;
          p_merchant_id: string;
          p_rc_number: string;
        };
        Returns: undefined;
      };
      record_credit_direct_client_completion: {
        Args: {
          p_checkout_transaction_id?: string;
          p_email?: string;
          p_order_id: string;
          p_session_id?: string;
          p_tracking_token?: string;
        };
        Returns: Json;
      };
      record_credit_direct_client_completion_v1: {
        Args: {
          p_checkout_transaction_id?: string;
          p_order_id: string;
          p_session_id?: string;
          p_tracking_token?: string;
        };
        Returns: Json;
      };
      record_event_worker_heartbeat_v1: {
        Args: {
          p_error_code?: string;
          p_processed_count?: number;
          p_status: string;
          p_worker_id: string;
          p_worker_name: string;
        };
        Returns: undefined;
      };
      record_external_order_inventory_units: {
        Args: {
          p_merchant_id: string;
          p_order_id: string;
          p_order_item_id: string;
          p_source?: string;
          p_units: Json;
        };
        Returns: Json;
      };
      record_juicyway_usdt_deposit_address: {
        Args: {
          p_address: Json;
          p_provider_status: string;
          p_session_id: string;
          p_transaction_id: string;
        };
        Returns: boolean;
      };
      record_klump_transaction_id: {
        Args: {
          p_klump_transaction_id: string;
          p_merchant_reference: string;
          p_tracking_token: string;
        };
        Returns: {
          code: string;
          transaction_id: string;
        }[];
      };
      record_manual_order_payment: {
        Args: {
          p_amount: number;
          p_currency: string;
          p_description: string;
          p_gateway_reference: string;
          p_idempotency_key: string;
          p_merchant_id: string;
          p_metadata: Json;
          p_order_id: string;
        };
        Returns: Json;
      };
      record_merchant_quiz_answer_key_review: {
        Args: { p_event_id: string; p_merchant_id: string; p_reviewed: Json };
        Returns: boolean;
      };
      record_merchant_settlement: {
        Args: {
          p_description: string;
          p_gateway: string;
          p_gateway_fee: number;
          p_gateway_reference: string;
          p_gross_amount: number;
          p_merchant_id: string;
          p_metadata: Json;
          p_platform_fee: number;
          p_source_id: string;
          p_source_type: string;
        };
        Returns: string;
      };
      record_merchant_settlement_v2: {
        Args: {
          p_description: string;
          p_gateway: string;
          p_gateway_fee: number;
          p_gateway_reference: string;
          p_gross_amount: number;
          p_merchant_id: string;
          p_metadata: Json;
          p_platform_fee: number;
          p_settlement_type?: string;
          p_source_id: string;
          p_source_type: string;
        };
        Returns: string;
      };
      record_nin_verification: {
        Args: {
          p_date_of_birth: string;
          p_first_name: string;
          p_last_name: string;
          p_merchant_id: string;
          p_nin: string;
        };
        Returns: undefined;
      };
      record_petrock_imei_submission: {
        Args: {
          p_lease_token?: string;
          p_lookup_id: string;
          p_next_poll_at: string;
          p_order_id: string;
          p_provider_status: string;
        };
        Returns: boolean;
      };
      record_petrock_remediation_submission: {
        Args: {
          p_next_poll_at: string;
          p_order_id: string;
          p_provider_order_id: string;
          p_provider_status: string;
        };
        Returns: boolean;
      };
      record_platform_domain_event_v1: {
        Args: {
          p_delivery_data: Json;
          p_event_data: Json;
          p_event_name: string;
          p_event_timestamp: string;
          p_event_type: string;
          p_external_event_id: string;
          p_merchant_id: string;
          p_metadata?: Json;
          p_page_url: string;
          p_producer: string;
          p_referrer: string;
          p_session_id: string;
          p_trust_level: string;
        };
        Returns: {
          already_enqueued: boolean;
          domain_event_id: string;
          queue_message_id: number;
        }[];
      };
      record_quiz_answer: {
        Args: {
          p_answer_payload: Json;
          p_attempt_id: string;
          p_question_slot_id: string;
          p_route_proof?: Json;
          p_trusted?: boolean;
          p_user_id?: string;
        };
        Returns: string;
      };
      record_receipt_claim_app_download_clicked_v2: {
        Args: { p_source: string; p_token_hash: string };
        Returns: undefined;
      };
      record_receipt_claim_click: {
        Args: { p_token_hash: string };
        Returns: undefined;
      };
      record_receipt_claim_click_v2: {
        Args: { p_source: string; p_token_hash: string };
        Returns: undefined;
      };
      record_receipt_claim_login_started: {
        Args: { p_token_hash: string };
        Returns: undefined;
      };
      record_receipt_claim_login_started_v2: {
        Args: { p_source: string; p_token_hash: string };
        Returns: undefined;
      };
      record_santa_interaction: {
        Args: {
          p_approved_price?: number;
          p_client_ip: string;
          p_discount_percentage?: number;
          p_interaction_type: string;
          p_merchant_slug: string;
          p_product_name?: string;
          p_requested_price?: number;
          p_santa_response?: string;
          p_session_id: string;
          p_user_message?: string;
        };
        Returns: undefined;
      };
      record_shipment_inventory_reconciliation: {
        Args: {
          p_error_code: string;
          p_error_context?: Json;
          p_merchant_id: string;
          p_order_id: string;
          p_provider: string;
          p_shipment_id: string;
          p_tracking_number: string;
        };
        Returns: string;
      };
      record_wallet_order_funding_event: {
        Args: {
          p_event_type: string;
          p_gateway_reference?: string;
          p_intent_id?: string;
          p_metadata?: Json;
          p_order_id?: string;
          p_transaction_id?: string;
        };
        Returns: undefined;
      };
      redeem_customer_wallet: {
        Args: {
          p_amount: number;
          p_customer_id: string;
          p_description?: string;
          p_merchant_id: string;
          p_source_id: string;
          p_source_type: string;
        };
        Returns: {
          new_balance: number;
          success: boolean;
          transaction_id: string;
        }[];
      };
      redeem_imei_wallet_and_begin_provider_submission: {
        Args: {
          p_amount: number;
          p_cost_usd: number;
          p_customer_id: string;
          p_description?: string;
          p_device_category?: string;
          p_feedback_token_hash: string;
          p_identifier_ciphertext: string;
          p_lookup_id: string;
          p_merchant_id: string;
          p_provider: string;
          p_provider_attempt_started_at: string;
          p_reference_id: string;
        };
        Returns: {
          new_balance: number;
          success: boolean;
          transaction_id: string;
        }[];
      };
      redeem_imei_wallet_payment: {
        Args: {
          p_amount: number;
          p_customer_id: string;
          p_description?: string;
          p_lookup_id: string;
          p_merchant_id: string;
        };
        Returns: {
          new_balance: number;
          success: boolean;
          transaction_id: string;
        }[];
      };
      redeem_loyalty_points: {
        Args: {
          p_customer_id: string;
          p_merchant_id: string;
          p_points: number;
          p_redemption_id: string;
          p_wallet_credit: number;
        };
        Returns: Json;
      };
      redeem_loyalty_points_legacy_rejected: {
        Args: {
          p_customer_id: string;
          p_merchant_id: string;
          p_points: number;
          p_wallet_credit: number;
        };
        Returns: Json;
      };
      redeem_points: {
        Args: {
          p_customer_id: string;
          p_merchant_id: string;
          p_order_id?: string;
          p_points: number;
        };
        Returns: {
          credit_amount: number;
          message: string;
          success: boolean;
        }[];
      };
      redeem_receipt_claim: { Args: { p_token_hash: string }; Returns: Json };
      redeem_receipt_claim_v2: {
        Args: { p_source: string; p_token_hash: string };
        Returns: Json;
      };
      redeem_savings_for_order: {
        Args: {
          p_amount: number;
          p_customer_id: string;
          p_goal_id: string;
          p_idempotency_key: string;
          p_merchant_id: string;
          p_order_id: string;
        };
        Returns: {
          goal_id: string;
          goal_status: string;
          redeemed_amount: number;
          redemption_id: string;
          remaining_goal_amount: number;
          success: boolean;
        }[];
      };
      redeem_vtu_wallet_payment: {
        Args: {
          p_amount: number;
          p_customer_id: string;
          p_description?: string;
          p_merchant_id: string;
          p_vtu_transaction_id: string;
        };
        Returns: {
          new_balance: number;
          success: boolean;
          transaction_id: string;
        }[];
      };
      redeem_wallet_for_order: {
        Args: {
          p_amount: number;
          p_customer_id: string;
          p_merchant_id: string;
          p_order_id: string;
          p_order_reference?: string;
        };
        Returns: {
          new_balance: number;
          redeemed_amount: number;
          success: boolean;
          transaction_id: string;
        }[];
      };
      redeem_wallet_for_remediation: {
        Args: {
          p_customer_id: string;
          p_merchant_id: string;
          p_order_id: string;
        };
        Returns: {
          currency: string;
          new_balance: number;
          success: boolean;
        }[];
      };
      refresh_analytics_views: { Args: never; Returns: undefined };
      refresh_customer_segments: {
        Args: { p_merchant_id: string };
        Returns: number;
      };
      refresh_platform_analytics_views: { Args: never; Returns: undefined };
      refresh_product_variant_media_projection: {
        Args: { p_product_id: string };
        Returns: undefined;
      };
      refund_customer_wallet_for_vtu: {
        Args: {
          p_amount: number;
          p_customer_id: string;
          p_description?: string;
          p_merchant_id: string;
          p_vtu_transaction_id: string;
        };
        Returns: {
          new_balance: number;
          success: boolean;
          transaction_id: string;
        }[];
      };
      refund_imei_wallet_payment: {
        Args: {
          p_amount: number;
          p_customer_id: string;
          p_description?: string;
          p_lookup_id: string;
          p_merchant_id: string;
        };
        Returns: {
          new_balance: number;
          success: boolean;
          transaction_id: string;
        }[];
      };
      refund_wallet_for_remediation: {
        Args: { p_order_id: string; p_reason?: string };
        Returns: boolean;
      };
      register_push_token: {
        Args: {
          p_app_type?: string;
          p_build_number?: number;
          p_device_name?: string;
          p_merchant_id: string;
          p_platform: string;
          p_token: string;
        };
        Returns: string;
      };
      release_expired_variant_inventory_reservations: {
        Args: {
          p_limit?: number;
          p_merchant_id?: string;
          p_reference_time?: string;
        };
        Returns: Json;
      };
      release_order_inventory_units: {
        Args: {
          p_merchant_id: string;
          p_order_id: string;
          p_target_status?: string;
        };
        Returns: Json;
      };
      release_wallet_credit_push: {
        Args: { p_claim_token: string; p_transaction_id: string };
        Returns: boolean;
      };
      rename_merchant_slug: {
        Args: { p_merchant_id: string; p_new_slug: string };
        Returns: Json;
      };
      repairs_catalog_publicly_enabled: {
        Args: { p_merchant_id: string };
        Returns: boolean;
      };
      replace_imported_order_items: {
        Args: {
          p_expected_updated_at: string;
          p_items: Json;
          p_merchant_id: string;
          p_order_id: string;
          p_order_patch: Json;
        };
        Returns: {
          external_id: string;
          fulfillment_details: Json;
          id: string;
          shipping_address: Json;
          tracking_token: string;
          updated_at: string;
        }[];
      };
      replace_imported_order_items_suppressing_order_notifications: {
        Args: {
          p_expected_updated_at: string;
          p_items: Json;
          p_merchant_id: string;
          p_order_id: string;
          p_order_patch: Json;
        };
        Returns: {
          external_id: string;
          fulfillment_details: Json;
          id: string;
          shipping_address: Json;
          tracking_token: string;
          updated_at: string;
        }[];
      };
      replace_merchant_payment_credential_pair: {
        Args: {
          p_client_id_ciphertext: string;
          p_client_id_kek_version: number;
          p_client_id_last4: string;
          p_environment: string;
          p_merchant_id: string;
          p_provider: string;
          p_secret_key_ciphertext: string;
          p_secret_key_kek_version: number;
          p_secret_key_last4: string;
        };
        Returns: undefined;
      };
      replace_order_items: {
        Args: {
          p_is_import?: boolean;
          p_items: Json;
          p_merchant_id: string;
          p_order_id: string;
          p_order_patch?: Json;
        };
        Returns: undefined;
      };
      replace_order_items_suppressing_order_notifications: {
        Args: {
          p_items: Json;
          p_merchant_id: string;
          p_order_id: string;
          p_order_patch?: Json;
        };
        Returns: undefined;
      };
      replace_shipping_provider_service_centres: {
        Args: {
          p_centres: Json;
          p_generation: string;
          p_provider: string;
          p_synced_at: string;
        };
        Returns: number;
      };
      replay_event_deliveries_batch_v1: {
        Args: {
          p_delivery_ids: string[];
          p_replay_reason: string;
          p_replayed_by: string;
        };
        Returns: number;
      };
      replay_event_delivery_v1: {
        Args: {
          p_delivery_id: string;
          p_replay_reason: string;
          p_replayed_by: string;
        };
        Returns: boolean;
      };
      replay_ingress_dead_letter_v1: {
        Args: {
          p_failure_id: string;
          p_replay_reason: string;
          p_replayed_by: string;
        };
        Returns: number;
      };
      request_product_description_attestation_grant: {
        Args: {
          p_expected_old_description: string | null;
          p_expected_old_sha256: string | null;
          p_expected_old_source_type: string | null;
          p_full_replacement: boolean;
          p_merchant_id: string;
          p_operation_id: string;
          p_product_id: string;
          p_proposed_description_sha256: string;
          p_purpose: string;
        };
        Returns: {
          expires_at: string;
          grant_id: string;
        }[];
      };
      reschedule_petrock_imei_lookup_poll: {
        Args: {
          p_lease_token: string;
          p_lookup_id: string;
          p_next_poll_at: string;
          p_provider_status: string;
        };
        Returns: boolean;
      };
      reschedule_petrock_remediation_order: {
        Args: {
          p_lease_token: string;
          p_next_poll_at: string;
          p_order_id: string;
          p_provider_status: string;
        };
        Returns: boolean;
      };
      reset_order_notification_outbox_dispatch: {
        Args: {
          p_claim_owner: string;
          p_event_type: string;
          p_merchant_id: string;
          p_order_id: string;
          p_outbox_id: string;
        };
        Returns: number;
      };
      reset_petrock_remediation_quote: {
        Args: { p_order_id: string; p_reason: string };
        Returns: boolean;
      };
      resolve_public_feed_merchant: {
        Args: { p_identifier: string; p_is_by_slug?: boolean };
        Returns: {
          business_name: string;
          country: string;
          gmc_variants_enabled: boolean;
          id: string;
          logo_url: string;
          payout_currency: string;
          slug: string;
        }[];
      };
      resolve_storefront_auth_merchant: {
        Args: { p_identifier: string };
        Returns: {
          business_name: string;
          custom_domain: string;
          id: string;
          is_published: boolean;
          slug: string;
        }[];
      };
      resolve_storefront_cached_merchant: {
        Args: { p_identifier: string };
        Returns: {
          custom_domain: string;
          feature_settings: Json;
          merchant_data: Json;
        }[];
      };
      resolve_storefront_public_snapshot_v2: {
        Args: { p_identifier: string };
        Returns: {
          custom_domain: string;
          feature_settings: Json;
          merchant_data: Json;
          resolution_status: string;
        };
      };
      restock_variant_inventory_units: {
        Args: {
          p_branch_id?: string;
          p_inventory_tracking_policy?: string;
          p_merchant_id: string;
          p_product_id: string;
          p_units: Json;
          p_variant_id?: string;
        };
        Returns: Json;
      };
      resume_customer_savings_goal: {
        Args: {
          p_actor_id?: string;
          p_customer_id: string;
          p_goal_id: string;
          p_merchant_id: string;
        };
        Returns: {
          goal_status: string;
          success: boolean;
        }[];
      };
      reverse_savings_redemption_for_order: {
        Args: {
          p_actor: string;
          p_merchant_id: string;
          p_order_id: string;
          p_reason?: string;
        };
        Returns: number;
      };
      reverse_vtu_wallet_payment: {
        Args: {
          p_merchant_id?: string;
          p_reason?: string;
          p_vtu_transaction_id: string;
        };
        Returns: {
          new_balance: number;
          reversal_transaction_id: string;
          reversed_amount: number;
          success: boolean;
        }[];
      };
      reverse_wallet_redemption: {
        Args: { p_merchant_id?: string; p_order_id: string; p_reason?: string };
        Returns: {
          new_balance: number;
          reversal_transaction_id: string;
          reversed_amount: number;
          success: boolean;
        }[];
      };
      rewrite_config_business_name: {
        Args: { cfg: Json; new_name: string; old_name: string };
        Returns: Json;
      };
      route_domain_event_v1: {
        Args: {
          p_active_destinations?: string[];
          p_destinations: string[];
          p_domain_event_id: string;
          p_queue_message_id: number;
          p_shadow?: boolean;
        };
        Returns: {
          already_routed: boolean;
          archived: boolean;
          delivery_count: number;
        }[];
      };
      sanitize_text_input: { Args: { input_text: string }; Returns: string };
      save_merchant_email_domain_registration: {
        Args: {
          p_actor_user_id: string;
          p_bounce_host: string;
          p_bounce_value: string;
          p_dkim_host: string;
          p_dkim_value: string;
          p_domain: string;
          p_merchant_id: string;
          p_status: string;
          p_verified_at: string;
          p_zeptomail_domain_id: string;
        };
        Returns: {
          bounce_host: string;
          bounce_value: string;
          dkim_host: string;
          dkim_value: string;
          domain: string;
          enabled: boolean;
          sender_local_part: string;
          status: string;
        }[];
      };
      save_merchant_email_domain_verification: {
        Args: {
          p_actor_user_id: string;
          p_bounce_host: string;
          p_bounce_value: string;
          p_checked_domain: string;
          p_checked_zeptomail_domain_id: string;
          p_dkim_host: string;
          p_dkim_value: string;
          p_merchant_id: string;
          p_status: string;
          p_verified_at: string;
          p_zeptomail_domain_id: string;
        };
        Returns: {
          bounce_host: string;
          bounce_value: string;
          dkim_host: string;
          dkim_value: string;
          domain: string;
          enabled: boolean;
          sender_local_part: string;
          status: string;
        }[];
      };
      save_mobile_admin_product_with_variants: {
        Args: {
          p_merchant_id: string;
          p_product_id: string;
          p_product_payload: Json;
          p_variant_model?: string;
          p_variants?: Json;
        };
        Returns: Json;
      };
      search_order_by_number: {
        Args: { p_merchant_id: string; p_search_term: string };
        Returns: {
          ad_tracking: Json | null;
          amount_paid: number | null;
          branch_id: string | null;
          buyer_reference: string | null;
          cancellation_reason: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          checkout_idempotency_key: string | null;
          checkout_request_hash: string | null;
          created_at: string | null;
          credit_notes: string | null;
          currency: string | null;
          customer_email: string | null;
          customer_id: string | null;
          customer_name: string | null;
          customer_phone: string | null;
          delivered_at: string | null;
          discount_amount: number | null;
          discount_code_id: string | null;
          exchange_rate: number | null;
          external_id: string | null;
          external_source: string | null;
          firs_csid: string | null;
          firs_irn: string | null;
          firs_qr_code: string | null;
          firs_submission_status: string | null;
          firs_submitted_at: string | null;
          fulfillment_details: Json | null;
          fulfillment_notification_cycle_id: string;
          fulfillment_type: string | null;
          gift_wrapping_fee: number;
          id: string;
          import_job_id: string | null;
          import_metadata: Json;
          imported_at: string | null;
          invoice_issue_date: string | null;
          invoice_note: string | null;
          invoice_pdf_url: string | null;
          invoice_type_code: string | null;
          is_credit_order: boolean | null;
          merchant_id: string;
          notes: string | null;
          order_number: string;
          original_currency: string | null;
          original_total: number | null;
          paid_transaction_id: string | null;
          payment_due_date: string | null;
          payment_method: string | null;
          payment_status: string;
          payment_terms: string | null;
          payout_id: string | null;
          payout_status: string | null;
          purchase_order_reference: string | null;
          recorded_by_user_id: string | null;
          selected_quote_id: string | null;
          self_fulfillment_data: Json | null;
          shipment_booking_lock_token: string | null;
          shipment_booking_started_at: string | null;
          shipment_id: string | null;
          shipped_at: string | null;
          shipping_address: Json | null;
          shipping_fee: number | null;
          shipping_pickup_details: Json | null;
          shipping_provider: string | null;
          shipping_rate_id: string | null;
          shipping_rate_name: string | null;
          shipping_status: string;
          source: string | null;
          subtotal: number | null;
          tax_amount: number | null;
          tax_basis: string | null;
          tax_exclusive_amount: number | null;
          tax_inclusive_amount: number | null;
          tax_point_date: string | null;
          total: number;
          tracking_number: string | null;
          tracking_token: string;
          transaction_date: string | null;
          updated_at: string | null;
          wallet_amount_used: number | null;
          wallet_transaction_id: string | null;
        }[];
        SetofOptions: {
          from: '*';
          to: 'orders';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      search_products_v2: {
        Args: {
          brand_filter?: string;
          category_id_filter?: string;
          condition_filter?: string;
          max_price_filter?: number;
          merchant_id_param: string;
          min_price_filter?: number;
          min_rating_filter?: number;
          parent_only?: boolean;
          result_limit?: number;
          result_offset?: number;
          search_query: string;
          sort_by?: string;
          status_filter?: string;
          stock_filter?: string;
        };
        Returns: {
          product_id: string;
          relevance: number;
          total_count: number;
        }[];
      };
      select_event_pipeline_replay_ids_v1: {
        Args: {
          p_destination: string;
          p_error_code?: string;
          p_from?: string;
          p_merchant_id?: string;
          p_status: string;
          p_to?: string;
        };
        Returns: string[];
      };
      send_notification_to_all_merchants: {
        Args: { p_notification_id: string };
        Returns: number;
      };
      send_notification_to_merchants: {
        Args: { p_merchant_ids: string[]; p_notification_id: string };
        Returns: number;
      };
      set_credit_direct_session: {
        Args: {
          p_checkout_token: string;
          p_merchant_id: string;
          p_order_id: string;
          p_session_id: string;
          p_signed_amount: number;
        };
        Returns: boolean;
      };
      set_customer_date_of_birth: {
        Args: { p_date_of_birth: string; p_merchant_id: string };
        Returns: string;
      };
      set_customer_username: {
        Args: { p_merchant_id: string; p_username: string };
        Returns: string;
      };
      set_merchant_email_domain_enabled: {
        Args: {
          p_actor_user_id: string;
          p_enabled: boolean;
          p_merchant_id: string;
        };
        Returns: {
          bounce_host: string;
          bounce_value: string;
          dkim_host: string;
          dkim_value: string;
          domain: string;
          enabled: boolean;
          sender_local_part: string;
          status: string;
        }[];
      };
      set_merchant_payment_credential: {
        Args: {
          p_ciphertext: string;
          p_credential_role: string;
          p_environment: string;
          p_kek_version: number;
          p_key_last4?: string;
          p_merchant_id: string;
          p_provider: string;
        };
        Returns: string;
      };
      set_merchant_virtual_terminal_code_if_absent: {
        Args: { p_code: string; p_merchant_id: string };
        Returns: undefined;
      };
      set_order_payment_ref: {
        Args: {
          p_gateway?: string;
          p_order_id: string;
          p_payment_ref: string;
          p_tracking_token?: string;
        };
        Returns: boolean;
      };
      set_petrock_eligibility_outcome: {
        Args: {
          p_carrier: string;
          p_customer_message: string;
          p_device_model: string;
          p_failure_reason?: string;
          p_order_id: string;
          p_status: string;
          p_status_segment: string;
        };
        Returns: boolean;
      };
      set_primary_domain: {
        Args: { domain_id_param: string; merchant_id_param: string };
        Returns: undefined;
      };
      set_vtu_transaction_voucher_pin: {
        Args: { p_transaction_id: string; p_voucher_pin: string };
        Returns: undefined;
      };
      smart_product_search: {
        Args: {
          merchant_id_param: string;
          result_limit?: number;
          search_query: string;
        };
        Returns: {
          brand: string;
          category: string;
          description: string;
          id: string;
          image_large: string;
          image_small: string;
          name: string;
          price: number;
          relevance: number;
        }[];
      };
      start_quiz_attempt: {
        Args: {
          p_event_id: string;
          p_integrity_tier: string;
          p_route_proof?: Json;
          p_user_id?: string;
        };
        Returns: Json;
      };
      start_quiz_attempt_with_device: {
        Args: {
          p_device_hash: string;
          p_device_route_proof: Json;
          p_event_id: string;
          p_integrity_tier: string;
          p_start_route_proof: Json;
          p_user_id: string;
        };
        Returns: Json;
      };
      storefront_merchant_has_paystack_subaccount: {
        Args: { p_merchant_id: string };
        Returns: boolean;
      };
      submit_quiz_answer: {
        Args: {
          p_answer: string;
          p_attempt_id: string;
          p_client_answered_at?: string;
          p_integrity_tier?: string;
          p_question_id: string;
          p_route_proof?: Json;
          p_user_id?: string;
        };
        Returns: Json;
      };
      subscribe_newsletter: {
        Args: { p_email: string; p_merchant_id?: string; p_source?: string };
        Returns: string;
      };
      swap_customer_savings_goal_device: {
        Args: {
          p_actor_id: string;
          p_customer_id: string;
          p_goal_id: string;
          p_merchant_id: string;
          p_product_id: string;
          p_product_snapshot: Json;
          p_target_amount: number;
          p_title: string;
          p_variant_id: string;
        };
        Returns: {
          current_amount: number;
          goal_id: string;
          goal_status: string;
          success: boolean;
          target_amount: number;
        }[];
      };
      sync_petrock_imei_provider_products: {
        Args: { p_rows: Json };
        Returns: number;
      };
      sync_petrock_remediation_products: {
        Args: { p_rows: Json };
        Returns: number;
      };
      sync_product_variants_for_product: {
        Args: { p_merchant_id: string; p_product_id: string; p_variants: Json };
        Returns: number;
      };
      sync_virtual_terminal_local: {
        Args: {
          p_account_name?: string;
          p_account_number?: string;
          p_active?: boolean;
          p_bank?: string;
          p_code: string;
          p_merchant_id: string;
          p_name?: string;
        };
        Returns: string;
      };
      unsubscribe_newsletter: {
        Args: { p_email: string; p_merchant_id?: string };
        Returns: boolean;
      };
      update_admin_order: {
        Args: { p_order_id: string; p_payload: Json };
        Returns: Json;
      };
      update_inventory_tracking_policy: {
        Args: {
          p_inventory_tracking_policy: string;
          p_merchant_id: string;
          p_product_id: string;
          p_variant_id?: string;
        };
        Returns: Json;
      };
      update_merchant_social_media: {
        Args: {
          p_clear?: boolean;
          p_merchant_id: string;
          p_settings?: Json;
          p_social_media?: Json;
        };
        Returns: Json;
      };
      update_transaction_review_details: {
        Args: {
          p_client_timezone?: string;
          p_cost_price: number;
          p_identifier_type?: string;
          p_identifier_value?: string;
          p_merchant_id: string;
          p_order_id: string;
          p_order_item_id: string;
          p_product_id: string;
          p_supplier_name: string;
          p_transaction_date: string;
          p_unit_index?: number;
          p_update_product_default?: boolean;
          p_variant_id: string;
        };
        Returns: undefined;
      };
      update_variant_inventory_unit: {
        Args: {
          p_branch_id?: string;
          p_identifier_value?: string;
          p_merchant_id: string;
          p_notes?: string;
          p_set_branch?: boolean;
          p_status?: string;
          p_unit_id: string;
        };
        Returns: Json;
      };
      upsert_customer_on_auth: {
        Args: {
          p_email: string;
          p_full_name?: string;
          p_merchant_id: string;
          p_phone?: string;
          p_user_id: string;
        };
        Returns: string;
      };
      upsert_customer_saved_address_from_order: {
        Args: {
          p_customer_id: string;
          p_customer_name: string;
          p_customer_phone: string;
          p_shipping_address: Json;
        };
        Returns: undefined;
      };
      validate_order_number: { Args: { order_num: string }; Returns: boolean };
      validate_order_shipment_inventory: {
        Args: {
          p_external_units?: Json;
          p_merchant_id: string;
          p_order_id: string;
        };
        Returns: Json;
      };
    };
    Enums: {
      negotiation_status: 'pending' | 'accepted' | 'rejected' | 'countered';
      repair_status:
        | 'pending'
        | 'confirmed'
        | 'in_progress'
        | 'completed'
        | 'cancelled'
        | 'rejected';
      staff_role:
        | 'admin'
        | 'manager'
        | 'sales_rep'
        | 'inventory'
        | 'accountant'
        | 'customer_service'
        | 'marketing'
        | 'fulfillment'
        | 'blog_manager';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  'public'
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      negotiation_status: ['pending', 'accepted', 'rejected', 'countered'],
      repair_status: [
        'pending',
        'confirmed',
        'in_progress',
        'completed',
        'cancelled',
        'rejected',
      ],
      staff_role: [
        'admin',
        'manager',
        'sales_rep',
        'inventory',
        'accountant',
        'customer_service',
        'marketing',
        'fulfillment',
        'blog_manager',
      ],
    },
  },
} as const;
