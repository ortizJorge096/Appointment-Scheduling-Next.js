output "db_endpoint" {
  description = "host:port of the new prod DB (restore target / app endpoint)."
  value       = module.rds.db_endpoint
}

output "database_url_ssm_parameter" {
  description = <<-EOT
    SSM path (in THIS free-tier account) holding the full DATABASE_URL. Read it and
    feed it to the main env's external_database_url:
      aws ssm get-parameter --profile <freetier-profile> --with-decryption \
        --name <this-value> --query Parameter.Value --output text
  EOT
  value       = module.rds.database_url_ssm_parameter
}

output "next_steps" {
  description = "Cross-account wiring reminder."
  value       = "1) Restore the .sql into ${module.rds.db_endpoint}. 2) Verify. 3) Set external_database_url in environments/prod to this DB's URL and re-apply the MAIN account."
}
