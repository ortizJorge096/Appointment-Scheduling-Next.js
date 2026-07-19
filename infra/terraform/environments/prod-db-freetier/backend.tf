terraform {
  # State in the SEPARATE free-tier account (ADR-013): same pattern as the main
  # account (encrypt + S3-native locking via use_lockfile, no DynamoDB), but a
  # bucket in the free-tier account so the two accounts never share state. The
  # state holds the DB master password, so encryption + a private bucket matter.
  backend "s3" {
    bucket       = "096jortiz-tfstate-freetier"
    key          = "prod-db-freetier/terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
    profile      = "freetier"
  }
}
