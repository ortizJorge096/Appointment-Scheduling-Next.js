# A $5 monthly cost budget on the free-tier account as a safety net (ADR-013): the
# new AWS Free Tier PLAN can incur real charges past its caps, and this account now
# holds prod. Email alerts fire early — at $1 (any real spend on an account that
# should sit near $0), at $4, and when the month is FORECAST to blow past $5.

variable "budget_alert_email" {
  description = "Email for the free-tier account's billing alerts. Set it in terraform.tfvars (gitignored). Empty = no budget."
  type        = string
  default     = ""
}

resource "aws_budgets_budget" "safety" {
  count = var.budget_alert_email != "" ? 1 : 0

  name         = "freetier-5usd-safety"
  budget_type  = "COST"
  limit_amount = "5"
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  # Early warning: ANY real spend (free tier should be ~$0, so $1 already means
  # something is being billed — "uno nunca sabe").
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 20
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.budget_alert_email]
  }
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.budget_alert_email]
  }
  # Projected to exceed the $5 cap this month.
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = [var.budget_alert_email]
  }
}
