# A monthly COST budget on the MAIN (prod) account as a spend guardrail. Unlike the
# free-tier account's $5 tripwire (environments/prod-db-freetier/budget.tf, which
# should sit near $0 so any spend is anomalous), this account has a REAL baseline —
# EC2, S3, ECR, data transfer (the RDS moved out, ADR-013). So the alerts here
# signal "the bill is running over budget", not "any spend at all". It is an ALERT,
# not a hard cap: AWS Budgets emails, it does NOT stop spending, and it refreshes
# only a few times a day.

variable "budget_alert_email" {
  description = "Email for the prod account's billing alerts. Set it in terraform.tfvars (gitignored). Empty = no budget."
  type        = string
  default     = ""
}

resource "aws_budgets_budget" "prod_spend" {
  count = var.budget_alert_email != "" ? 1 : 0

  name         = "appointment-scheduling-prod-15usd"
  budget_type  = "COST"
  limit_amount = "15"
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  # 80% ($12): heads-up that the month is running warm.
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.budget_alert_email]
  }
  # 100% ($15) actual: already over budget this month.
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.budget_alert_email]
  }
  # 100% ($15) forecast: on track to blow the cap by month end (the earliest signal).
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = [var.budget_alert_email]
  }
}
