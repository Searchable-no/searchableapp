# Billing and Subscription Setup Instructions

To set up the billing and subscription system, run the following SQL commands in your Supabase SQL Editor:

```sql
-- Create plans table
CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  billing_interval TEXT NOT NULL DEFAULT 'month', -- 'month' or 'year'
  features JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'active', -- active, canceled, past_due, etc.
  stripe_subscription_id TEXT UNIQUE,
  current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT false,
  canceled_at TIMESTAMP WITH TIME ZONE,
  trial_start TIMESTAMP WITH TIME ZONE,
  trial_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  status TEXT NOT NULL, -- paid, open, void, uncollectible
  stripe_invoice_id TEXT UNIQUE,
  stripe_charge_id TEXT,
  invoice_pdf TEXT,
  invoice_number TEXT,
  description TEXT,
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Insert some default plans
INSERT INTO plans (name, description, price, features, billing_interval) 
VALUES 
('Free', 'Basic features for small teams', 0.00, '{"users": 1, "storage": "1GB", "features": ["Basic search", "Document storage"]}', 'month'),
('Pro', 'Advanced features for growing teams', 19.99, '{"users": 5, "storage": "10GB", "features": ["Advanced search", "Document storage", "Team collaboration", "Priority support"]}', 'month'),
('Enterprise', 'Full feature set for large organizations', 99.99, '{"users": 20, "storage": "100GB", "features": ["Advanced search", "Document storage", "Team collaboration", "Priority support", "Custom integrations", "Dedicated account manager"]}', 'month')
ON CONFLICT DO NOTHING;
```

## After Running the SQL

1. Go to your application
2. Navigate to the Admin section
3. You should now see the Subscriptions and Invoices tabs
4. The system will show mock data initially until real subscriptions are created

## Integration with Payment Processor

For a real application, you would integrate with Stripe or another payment processor:

1. Create a Stripe account and get API keys
2. Set up webhooks to receive payment events
3. Implement Stripe Checkout for subscription sign-ups
4. Update the subscription status based on Stripe webhook events

## Next Steps

1. Implement a customer portal for users to manage their own subscriptions
2. Set up automated invoice generation
3. Create usage tracking for metered billing features 