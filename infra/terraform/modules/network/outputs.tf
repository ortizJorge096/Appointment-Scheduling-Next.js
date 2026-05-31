output "vpc_id" {
  description = "ID de la VPC."
  value       = aws_vpc.this.id
}

output "vpc_cidr" {
  description = "CIDR de la VPC."
  value       = aws_vpc.this.cidr_block
}

output "public_subnet_ids" {
  description = "IDs de las subredes públicas (una por AZ)."
  value       = aws_subnet.public[*].id
}

output "db_subnet_ids" {
  description = "IDs de las subredes privadas para el subnet group de RDS."
  value       = aws_subnet.db[*].id
}

output "internet_gateway_id" {
  description = "ID del Internet Gateway."
  value       = aws_internet_gateway.this.id
}
