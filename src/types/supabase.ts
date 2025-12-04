export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '13.0.5';
  };
  public: {
    Tables: {
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
            referencedRelation: 'merchants';
            referencedColumns: ['id'];
          },
        ];
      };
      blog_categories: {
        Row: {
          created_at: string | null;
          description: string | null;
          id: string;
          merchant_id: string;
          name: string;
          slug: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          description?: string | null;
          id?: string;
          merchant_id: string;
          name: string;
          slug: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          description?: string | null;
          id?: string;
          merchant_id?: string;
          name?: string;
          slug?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'blog_categories_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchants';
            referencedColumns: ['id'];
          },
        ];
      };
      blog_posts: {
        Row: {
          author: string | null;
          category_id: string | null;
          content: string;
          created_at: string | null;
          excerpt: string | null;
          featured_image: string | null;
          id: string;
          merchant_id: string;
          meta_description: string | null;
          meta_title: string | null;
          published_at: string | null;
          slug: string;
          status: string | null;
          tags: string[] | null;
          title: string;
          updated_at: string | null;
        };
        Insert: {
          author?: string | null;
          category_id?: string | null;
          content: string;
          created_at?: string | null;
          excerpt?: string | null;
          featured_image?: string | null;
          id?: string;
          merchant_id: string;
          meta_description?: string | null;
          meta_title?: string | null;
          published_at?: string | null;
          slug: string;
          status?: string | null;
          tags?: string[] | null;
          title: string;
          updated_at?: string | null;
        };
        Update: {
          author?: string | null;
          category_id?: string | null;
          content?: string;
          created_at?: string | null;
          excerpt?: string | null;
          featured_image?: string | null;
          id?: string;
          merchant_id?: string;
          meta_description?: string | null;
          meta_title?: string | null;
          published_at?: string | null;
          slug?: string;
          status?: string | null;
          tags?: string[] | null;
          title?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'blog_posts_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'blog_categories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'blog_posts_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchants';
            referencedColumns: ['id'];
          },
        ];
      };
      crawler_logs: {
        Row: {
          created_at: string | null;
          error_message: string | null;
          id: string;
          merchant_id: string;
          pages_crawled: number | null;
          source_url: string;
          status: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          error_message?: string | null;
          id?: string;
          merchant_id: string;
          pages_crawled?: number | null;
          source_url: string;
          status: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          error_message?: string | null;
          id?: string;
          merchant_id?: string;
          pages_crawled?: number | null;
          source_url?: string;
          status?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'crawler_logs_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchants';
            referencedColumns: ['id'];
          },
        ];
      };
      customer_loyalty: {
        Row: {
          created_at: string | null;
          customer_email: string;
          id: string;
          lifetime_points: number | null;
          merchant_id: string;
          points_balance: number | null;
          tier: string | null;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          customer_email: string;
          id?: string;
          lifetime_points?: number | null;
          merchant_id: string;
          points_balance?: number | null;
          tier?: string | null;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          customer_email?: string;
          id?: string;
          lifetime_points?: number | null;
          merchant_id?: string;
          points_balance?: number | null;
          tier?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'customer_loyalty_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchants';
            referencedColumns: ['id'];
          },
        ];
      };
      customer_rfm_scores: {
        Row: {
          created_at: string | null;
          customer_email: string;
          frequency_score: number;
          id: string;
          last_order_date: string | null;
          merchant_id: string;
          monetary_score: number;
          recency_score: number;
          segment: string;
          total_orders: number | null;
          total_spent: number | null;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          customer_email: string;
          frequency_score: number;
          id?: string;
          last_order_date?: string | null;
          merchant_id: string;
          monetary_score: number;
          recency_score: number;
          segment: string;
          total_orders?: number | null;
          total_spent?: number | null;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          customer_email?: string;
          frequency_score?: number;
          id?: string;
          last_order_date?: string | null;
          merchant_id?: string;
          monetary_score?: number;
          recency_score?: number;
          segment?: string;
          total_orders?: number | null;
          total_spent?: number | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'customer_rfm_scores_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchants';
            referencedColumns: ['id'];
          },
        ];
      };
      inventory_alerts: {
        Row: {
          created_at: string | null;
          id: string;
          is_resolved: boolean | null;
          merchant_id: string;
          message: string;
          product_id: string | null;
          resolved_at: string | null;
          severity: string;
          type: string;
          variant_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          is_resolved?: boolean | null;
          merchant_id: string;
          message: string;
          product_id?: string | null;
          resolved_at?: string | null;
          severity: string;
          type: string;
          variant_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          is_resolved?: boolean | null;
          merchant_id?: string;
          message?: string;
          product_id?: string | null;
          resolved_at?: string | null;
          severity?: string;
          type?: string;
          variant_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'inventory_alerts_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'inventory_alerts_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'inventory_alerts_variant_id_fkey';
            columns: ['variant_id'];
            isOneToOne: false;
            referencedRelation: 'product_variants';
            referencedColumns: ['id'];
          },
        ];
      };
      inventory_snapshots: {
        Row: {
          created_at: string | null;
          id: string;
          merchant_id: string;
          product_id: string;
          quantity: number;
          snapshot_date: string;
          variant_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          merchant_id: string;
          product_id: string;
          quantity: number;
          snapshot_date?: string;
          variant_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          merchant_id?: string;
          product_id?: string;
          quantity?: number;
          snapshot_date?: string;
          variant_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'inventory_snapshots_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'inventory_snapshots_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'inventory_snapshots_variant_id_fkey';
            columns: ['variant_id'];
            isOneToOne: false;
            referencedRelation: 'product_variants';
            referencedColumns: ['id'];
          },
        ];
      };
      loyalty_rewards: {
        Row: {
          cost_points: number;
          created_at: string | null;
          description: string | null;
          id: string;
          is_active: boolean | null;
          merchant_id: string;
          name: string;
          type: string;
          updated_at: string | null;
          value: number;
        };
        Insert: {
          cost_points: number;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          is_active?: boolean | null;
          merchant_id: string;
          name: string;
          type: string;
          updated_at?: string | null;
          value: number;
        };
        Update: {
          cost_points?: number;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          is_active?: boolean | null;
          merchant_id?: string;
          name?: string;
          type?: string;
          updated_at?: string | null;
          value?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'loyalty_rewards_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchants';
            referencedColumns: ['id'];
          },
        ];
      };
      loyalty_settings: {
        Row: {
          created_at: string | null;
          expiry_months: number | null;
          id: string;
          merchant_id: string;
          min_redeem_points: number | null;
          points_per_currency: number | null;
          program_name: string | null;
          signup_bonus: number | null;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          expiry_months?: number | null;
          id?: string;
          merchant_id: string;
          min_redeem_points?: number | null;
          points_per_currency?: number | null;
          program_name?: string | null;
          signup_bonus?: number | null;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          expiry_months?: number | null;
          id?: string;
          merchant_id?: string;
          min_redeem_points?: number | null;
          points_per_currency?: number | null;
          program_name?: string | null;
          signup_bonus?: number | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'loyalty_settings_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: true;
            referencedRelation: 'merchants';
            referencedColumns: ['id'];
          },
        ];
      };
      merchant_feature_settings: {
        Row: {
          about_page_enabled: boolean | null;
          auto_blog_enabled: boolean | null;
          auto_generate_schema: boolean | null;
          blog_enabled: boolean | null;
          checkout_collect_phone: boolean | null;
          checkout_require_account: boolean | null;
          checkout_show_order_notes: boolean | null;
          contact_page_enabled: boolean | null;
          created_at: string | null;
          custom_robots_txt: string | null;
          custom_settings: Json | null;
          discount_codes_enabled: boolean | null;
          email_notifications_enabled: boolean | null;
          facebook_pixel_id: string | null;
          faq_page_enabled: boolean | null;
          free_shipping_threshold: number | null;
          google_analytics_id: string | null;
          google_place_id: string | null;
          google_reviews_enabled: boolean | null;
          guest_checkout_enabled: boolean | null;
          id: string;
          low_stock_threshold: number | null;
          loyalty_enabled: boolean | null;
          merchant_id: string;
          order_tracking_enabled: boolean | null;
          pay_on_delivery_enabled: boolean | null;
          privacy_page_enabled: boolean | null;
          reviews_enabled: boolean | null;
          rewards_page_enabled: boolean | null;
          shipping_markup_percentage: number | null;
          shipping_providers: Json | null;
          show_recent_purchases: boolean | null;
          show_stock_levels: boolean | null;
          sms_notifications_enabled: boolean | null;
          terms_page_enabled: boolean | null;
          tiktok_pixel_id: string | null;
          updated_at: string | null;
          wishlist_enabled: boolean | null;
        };
        Insert: {
          about_page_enabled?: boolean | null;
          auto_blog_enabled?: boolean | null;
          auto_generate_schema?: boolean | null;
          blog_enabled?: boolean | null;
          checkout_collect_phone?: boolean | null;
          checkout_require_account?: boolean | null;
          checkout_show_order_notes?: boolean | null;
          contact_page_enabled?: boolean | null;
          created_at?: string | null;
          custom_robots_txt?: string | null;
          custom_settings?: Json | null;
          discount_codes_enabled?: boolean | null;
          email_notifications_enabled?: boolean | null;
          facebook_pixel_id?: string | null;
          faq_page_enabled?: boolean | null;
          free_shipping_threshold?: number | null;
          google_analytics_id?: string | null;
          google_place_id?: string | null;
          google_reviews_enabled?: boolean | null;
          guest_checkout_enabled?: boolean | null;
          id?: string;
          low_stock_threshold?: number | null;
          loyalty_enabled?: boolean | null;
          merchant_id: string;
          order_tracking_enabled?: boolean | null;
          pay_on_delivery_enabled?: boolean | null;
          privacy_page_enabled?: boolean | null;
          reviews_enabled?: boolean | null;
          rewards_page_enabled?: boolean | null;
          shipping_markup_percentage?: number | null;
          shipping_providers?: Json | null;
          show_recent_purchases?: boolean | null;
          show_stock_levels?: boolean | null;
          sms_notifications_enabled?: boolean | null;
          terms_page_enabled?: boolean | null;
          tiktok_pixel_id?: string | null;
          updated_at?: string | null;
          wishlist_enabled?: boolean | null;
        };
        Update: {
          about_page_enabled?: boolean | null;
          auto_blog_enabled?: boolean | null;
          auto_generate_schema?: boolean | null;
          blog_enabled?: boolean | null;
          checkout_collect_phone?: boolean | null;
          checkout_require_account?: boolean | null;
          checkout_show_order_notes?: boolean | null;
          contact_page_enabled?: boolean | null;
          created_at?: string | null;
          custom_robots_txt?: string | null;
          custom_settings?: Json | null;
          discount_codes_enabled?: boolean | null;
          email_notifications_enabled?: boolean | null;
          facebook_pixel_id?: string | null;
          faq_page_enabled?: boolean | null;
          free_shipping_threshold?: number | null;
          google_analytics_id?: string | null;
          google_place_id?: string | null;
          google_reviews_enabled?: boolean | null;
          guest_checkout_enabled?: boolean | null;
          id?: string;
          low_stock_threshold?: number | null;
          loyalty_enabled?: boolean | null;
          merchant_id?: string;
          order_tracking_enabled?: boolean | null;
          pay_on_delivery_enabled?: boolean | null;
          privacy_page_enabled?: boolean | null;
          reviews_enabled?: boolean | null;
          rewards_page_enabled?: boolean | null;
          shipping_markup_percentage?: number | null;
          shipping_providers?: Json | null;
          show_recent_purchases?: boolean | null;
          show_stock_levels?: boolean | null;
          sms_notifications_enabled?: boolean | null;
          terms_page_enabled?: boolean | null;
          tiktok_pixel_id?: string | null;
          updated_at?: string | null;
          wishlist_enabled?: boolean | null;
        };
        Relationships: [
          {
            foreignKeyName: 'merchant_feature_settings_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: true;
            referencedRelation: 'merchants';
            referencedColumns: ['id'];
          },
        ];
      };
      merchants: {
        Row: {
          bank_account_name: string | null;
          bank_account_number: string | null;
          bank_code: string | null;
          bank_name: string | null;
          brand_colors: Json | null;
          business_address: string | null;
          business_name: string;
          business_type: string | null;
          country: string | null;
          created_at: string | null;
          email: string;
          facebook_capi_token: string | null;
          favicon_apple_touch_url: string | null;
          favicon_png_192_url: string | null;
          favicon_png_32_url: string | null;
          favicon_svg_url: string | null;
          favicon_uploaded_at: string | null;
          feature_settings: Json | null;
          ga4_api_secret: string | null;
          hero_image_ids: string[] | null;
          hero_images_generated_at: string | null;
          hero_images_regeneration_count: number | null;
          id: string;
          is_platform_admin: boolean | null;
          logo_url: string | null;
          multi_currency_enabled: boolean | null;
          pages: Json | null;
          paystack_subaccount_code: string | null;
          payout_currency: string | null;
          phone: string | null;
          rider_phone_number: string | null;
          self_fulfillment_enabled: boolean | null;
          site_description: string | null;
          site_tagline: string | null;
          site_title: string | null;
          slug: string;
          snapchat_capi_token: string | null;
          snapchat_pixel_id: string | null;
          social_media: Json | null;
          support_email: string | null;
          support_phone: string | null;
          tiktok_access_token: string | null;
          tiktok_pixel_id: string | null;
          twitter_pixel_id: string | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          bank_account_name?: string | null;
          bank_account_number?: string | null;
          bank_code?: string | null;
          bank_name?: string | null;
          brand_colors?: Json | null;
          business_address?: string | null;
          business_name: string;
          business_type?: string | null;
          country?: string | null;
          created_at?: string | null;
          email: string;
          facebook_capi_token?: string | null;
          favicon_apple_touch_url?: string | null;
          favicon_png_192_url?: string | null;
          favicon_png_32_url?: string | null;
          favicon_svg_url?: string | null;
          favicon_uploaded_at?: string | null;
          feature_settings?: Json | null;
          ga4_api_secret?: string | null;
          hero_image_ids?: string[] | null;
          hero_images_generated_at?: string | null;
          hero_images_regeneration_count?: number | null;
          id?: string;
          is_platform_admin?: boolean | null;
          logo_url?: string | null;
          multi_currency_enabled?: boolean | null;
          pages?: Json | null;
          paystack_subaccount_code?: string | null;
          payout_currency?: string | null;
          phone?: string | null;
          rider_phone_number?: string | null;
          self_fulfillment_enabled?: boolean | null;
          site_description?: string | null;
          site_tagline?: string | null;
          site_title?: string | null;
          slug: string;
          snapchat_capi_token?: string | null;
          snapchat_pixel_id?: string | null;
          social_media?: Json | null;
          support_email?: string | null;
          support_phone?: string | null;
          tiktok_access_token?: string | null;
          tiktok_pixel_id?: string | null;
          twitter_pixel_id?: string | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          bank_account_name?: string | null;
          bank_account_number?: string | null;
          bank_code?: string | null;
          bank_name?: string | null;
          brand_colors?: Json | null;
          business_address?: string | null;
          business_name?: string;
          business_type?: string | null;
          country?: string | null;
          created_at?: string | null;
          email?: string;
          facebook_capi_token?: string | null;
          favicon_apple_touch_url?: string | null;
          favicon_png_192_url?: string | null;
          favicon_png_32_url?: string | null;
          favicon_svg_url?: string | null;
          favicon_uploaded_at?: string | null;
          feature_settings?: Json | null;
          ga4_api_secret?: string | null;
          hero_image_ids?: string[] | null;
          hero_images_generated_at?: string | null;
          hero_images_regeneration_count?: number | null;
          id?: string;
          is_platform_admin?: boolean | null;
          logo_url?: string | null;
          multi_currency_enabled?: boolean | null;
          pages?: Json | null;
          paystack_subaccount_code?: string | null;
          payout_currency?: string | null;
          phone?: string | null;
          rider_phone_number?: string | null;
          self_fulfillment_enabled?: boolean | null;
          site_description?: string | null;
          site_tagline?: string | null;
          site_title?: string | null;
          slug?: string;
          snapchat_capi_token?: string | null;
          snapchat_pixel_id?: string | null;
          social_media?: Json | null;
          support_email?: string | null;
          support_phone?: string | null;
          tiktok_access_token?: string | null;
          tiktok_pixel_id?: string | null;
          twitter_pixel_id?: string | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      newsletter_subscribers: {
        Row: {
          created_at: string | null;
          email: string;
          id: string;
          is_active: boolean | null;
          merchant_id: string;
          source: string | null;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          email: string;
          id?: string;
          is_active?: boolean | null;
          merchant_id: string;
          source?: string | null;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          email?: string;
          id?: string;
          is_active?: boolean | null;
          merchant_id?: string;
          source?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'newsletter_subscribers_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchants';
            referencedColumns: ['id'];
          },
        ];
      };
      notifications: {
        Row: {
          channels: string[];
          content: Json;
          created_at: string | null;
          id: string;
          merchant_id: string;
          metadata: Json | null;
          recipient_id: string | null;
          scheduled_at: string | null;
          status: string;
          system_generated: boolean | null;
          template_id: string | null;
          type: string;
          updated_at: string | null;
        };
        Insert: {
          channels?: string[];
          content: Json;
          created_at?: string | null;
          id?: string;
          merchant_id: string;
          metadata?: Json | null;
          recipient_id?: string | null;
          scheduled_at?: string | null;
          status?: string;
          system_generated?: boolean | null;
          template_id?: string | null;
          type: string;
          updated_at?: string | null;
        };
        Update: {
          channels?: string[];
          content?: Json;
          created_at?: string | null;
          id?: string;
          merchant_id?: string;
          metadata?: Json | null;
          recipient_id?: string | null;
          scheduled_at?: string | null;
          status?: string;
          system_generated?: boolean | null;
          template_id?: string | null;
          type?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'notifications_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchants';
            referencedColumns: ['id'];
          },
        ];
      };
      order_items: {
        Row: {
          created_at: string | null;
          id: string;
          order_id: string;
          price: number;
          product_id: string;
          quantity: number;
          variant_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          order_id: string;
          price: number;
          product_id: string;
          quantity: number;
          variant_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          order_id?: string;
          price?: number;
          product_id?: string;
          quantity?: number;
          variant_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'order_items_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_items_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_items_variant_id_fkey';
            columns: ['variant_id'];
            isOneToOne: false;
            referencedRelation: 'product_variants';
            referencedColumns: ['id'];
          },
        ];
      };
      orders: {
        Row: {
          created_at: string | null;
          currency: string;
          customer_email: string;
          customer_name: string;
          customer_phone: string | null;
          id: string;
          merchant_id: string;
          payment_method: string | null;
          payment_status: string;
          shipping_address: Json | null;
          shipping_cost: number;
          status: string;
          subtotal: number;
          total: number;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          currency?: string;
          customer_email: string;
          customer_name: string;
          customer_phone?: string | null;
          id?: string;
          merchant_id: string;
          payment_method?: string | null;
          payment_status?: string;
          shipping_address?: Json | null;
          shipping_cost?: number;
          status?: string;
          subtotal: number;
          total: number;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          currency?: string;
          customer_email?: string;
          customer_name?: string;
          customer_phone?: string | null;
          id?: string;
          merchant_id?: string;
          payment_method?: string | null;
          payment_status?: string;
          shipping_address?: Json | null;
          shipping_cost?: number;
          status?: string;
          subtotal?: number;
          total?: number;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'orders_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchants';
            referencedColumns: ['id'];
          },
        ];
      };
      platform_blog_posts: {
        Row: {
          author: string | null;
          content: string;
          created_at: string | null;
          excerpt: string | null;
          featured_image: string | null;
          id: string;
          meta_description: string | null;
          meta_title: string | null;
          published_at: string | null;
          slug: string;
          status: string | null;
          tags: string[] | null;
          title: string;
          updated_at: string | null;
        };
        Insert: {
          author?: string | null;
          content: string;
          created_at?: string | null;
          excerpt?: string | null;
          featured_image?: string | null;
          id?: string;
          meta_description?: string | null;
          meta_title?: string | null;
          published_at?: string | null;
          slug: string;
          status?: string | null;
          tags?: string[] | null;
          title: string;
          updated_at?: string | null;
        };
        Update: {
          author?: string | null;
          content?: string;
          created_at?: string | null;
          excerpt?: string | null;
          featured_image?: string | null;
          id?: string;
          meta_description?: string | null;
          meta_title?: string | null;
          published_at?: string | null;
          slug?: string;
          status?: string | null;
          tags?: string[] | null;
          title?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      points_transactions: {
        Row: {
          created_at: string | null;
          customer_email: string;
          description: string | null;
          id: string;
          merchant_id: string;
          points: number;
          reference_id: string | null;
          type: string;
        };
        Insert: {
          created_at?: string | null;
          customer_email: string;
          description?: string | null;
          id?: string;
          merchant_id: string;
          points: number;
          reference_id?: string | null;
          type: string;
        };
        Update: {
          created_at?: string | null;
          customer_email?: string;
          description?: string | null;
          id?: string;
          merchant_id?: string;
          points?: number;
          reference_id?: string | null;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'points_transactions_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchants';
            referencedColumns: ['id'];
          },
        ];
      };
      product_images: {
        Row: {
          alt_text: string | null;
          created_at: string | null;
          display_order: number;
          id: string;
          product_id: string;
          url: string;
        };
        Insert: {
          alt_text?: string | null;
          created_at?: string | null;
          display_order?: number;
          id?: string;
          product_id: string;
          url: string;
        };
        Update: {
          alt_text?: string | null;
          created_at?: string | null;
          display_order?: number;
          id?: string;
          product_id?: string;
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'product_images_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
        ];
      };
      product_reviews: {
        Row: {
          comment: string | null;
          created_at: string | null;
          customer_email: string | null;
          customer_name: string;
          id: string;
          is_verified_purchase: boolean | null;
          merchant_id: string;
          product_id: string;
          rating: number;
          status: string;
          updated_at: string | null;
        };
        Insert: {
          comment?: string | null;
          created_at?: string | null;
          customer_email?: string | null;
          customer_name: string;
          id?: string;
          is_verified_purchase?: boolean | null;
          merchant_id: string;
          product_id: string;
          rating: number;
          status?: string;
          updated_at?: string | null;
        };
        Update: {
          comment?: string | null;
          created_at?: string | null;
          customer_email?: string | null;
          customer_name?: string;
          id?: string;
          is_verified_purchase?: boolean | null;
          merchant_id?: string;
          product_id?: string;
          rating?: number;
          status?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'product_reviews_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'product_reviews_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
        ];
      };
      product_variants: {
        Row: {
          created_at: string | null;
          id: string;
          inventory_quantity: number;
          name: string;
          price: number;
          product_id: string;
          sku: string | null;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          inventory_quantity?: number;
          name: string;
          price: number;
          product_id: string;
          sku?: string | null;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          inventory_quantity?: number;
          name?: string;
          price?: number;
          product_id?: string;
          sku?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'product_variants_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
        ];
      };
      products: {
        Row: {
          category: string | null;
          created_at: string | null;
          description: string | null;
          id: string;
          inventory_quantity: number;
          merchant_id: string;
          name: string;
          price: number;
          slug: string;
          status: string;
          updated_at: string | null;
        };
        Insert: {
          category?: string | null;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          inventory_quantity?: number;
          merchant_id: string;
          name: string;
          price: number;
          slug: string;
          status?: string;
          updated_at?: string | null;
        };
        Update: {
          category?: string | null;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          inventory_quantity?: number;
          merchant_id?: string;
          name?: string;
          price?: number;
          slug?: string;
          status?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'products_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchants';
            referencedColumns: ['id'];
          },
        ];
      };
      reorder_suggestions: {
        Row: {
          confidence_score: number;
          created_at: string | null;
          customer_email: string;
          days_until_reorder: number;
          id: string;
          last_order_date: string;
          merchant_id: string;
          predicted_reorder_date: string;
          product_id: string;
          variant_id: string | null;
        };
        Insert: {
          confidence_score: number;
          created_at?: string | null;
          customer_email: string;
          days_until_reorder: number;
          id?: string;
          last_order_date: string;
          merchant_id: string;
          predicted_reorder_date: string;
          product_id: string;
          variant_id?: string | null;
        };
        Update: {
          confidence_score?: number;
          created_at?: string | null;
          customer_email?: string;
          days_until_reorder?: number;
          id?: string;
          last_order_date?: string;
          merchant_id?: string;
          predicted_reorder_date?: string;
          product_id?: string;
          variant_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'reorder_suggestions_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reorder_suggestions_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reorder_suggestions_variant_id_fkey';
            columns: ['variant_id'];
            isOneToOne: false;
            referencedRelation: 'product_variants';
            referencedColumns: ['id'];
          },
        ];
      };
      reward_redemptions: {
        Row: {
          created_at: string | null;
          customer_email: string;
          id: string;
          merchant_id: string;
          points_spent: number;
          reward_id: string;
          status: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          customer_email: string;
          id?: string;
          merchant_id: string;
          points_spent: number;
          reward_id: string;
          status?: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          customer_email?: string;
          id?: string;
          merchant_id?: string;
          points_spent?: number;
          reward_id?: string;
          status?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'reward_redemptions_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reward_redemptions_reward_id_fkey';
            columns: ['reward_id'];
            isOneToOne: false;
            referencedRelation: 'loyalty_rewards';
            referencedColumns: ['id'];
          },
        ];
      };
      segment_definitions: {
        Row: {
          conditions: Json;
          created_at: string | null;
          description: string | null;
          id: string;
          merchant_id: string | null;
          name: string;
          updated_at: string | null;
        };
        Insert: {
          conditions: Json;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          merchant_id?: string | null;
          name: string;
          updated_at?: string | null;
        };
        Update: {
          conditions?: Json;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          merchant_id?: string | null;
          name?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'segment_definitions_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'merchants';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      staff_role: [
        'admin',
        'manager',
        'sales_rep',
        'inventory',
        'accountant',
        'customer_service',
        'marketing',
        'fulfillment',
      ];
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

// Helper type to exclude internal Supabase schema
type PublicSchema = Exclude<keyof Database, '__InternalSupabase'>;

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (Database['public']['Tables'] & Database['public']['Views'])
    | { schema: PublicSchema },
  TableName extends PublicTableNameOrOptions extends { schema: PublicSchema }
    ? keyof (Database[PublicTableNameOrOptions['schema']]['Tables'] &
        Database[PublicTableNameOrOptions['schema']]['Views'])
    : never = never,
> = PublicTableNameOrOptions extends { schema: PublicSchema }
  ? (Database[PublicTableNameOrOptions['schema']]['Tables'] &
      Database[PublicTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (Database['public']['Tables'] &
        Database['public']['Views'])
    ? (Database['public']['Tables'] &
        Database['public']['Views'])[PublicTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof Database['public']['Tables']
    | { schema: PublicSchema },
  TableName extends PublicTableNameOrOptions extends { schema: PublicSchema }
    ? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
    : never = never,
> = PublicTableNameOrOptions extends { schema: PublicSchema }
  ? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof Database['public']['Tables']
    ? Database['public']['Tables'][PublicTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof Database['public']['Tables']
    | { schema: PublicSchema },
  TableName extends PublicTableNameOrOptions extends { schema: PublicSchema }
    ? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
    : never = never,
> = PublicTableNameOrOptions extends { schema: PublicSchema }
  ? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof Database['public']['Tables']
    ? Database['public']['Tables'][PublicTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof Database['public']['Enums']
    | { schema: PublicSchema },
  EnumName extends PublicEnumNameOrOptions extends { schema: PublicSchema }
    ? keyof Database[PublicEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = PublicEnumNameOrOptions extends { schema: PublicSchema }
  ? Database[PublicEnumNameOrOptions['schema']]['Enums'][EnumName]
  : PublicEnumNameOrOptions extends keyof Database['public']['Enums']
    ? Database['public']['Enums'][PublicEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof Database['public']['CompositeTypes']
    | { schema: PublicSchema },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: PublicSchema;
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: PublicSchema }
  ? Database[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof Database['public']['CompositeTypes']
    ? Database['public']['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;
