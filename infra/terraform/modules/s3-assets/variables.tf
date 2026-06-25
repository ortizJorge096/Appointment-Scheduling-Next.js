variable "bucket_name" {
  description = "Globally unique bucket name (e.g.: appointment-scheduling-assets-<env>)."
  type        = string
}

variable "public_prefixes" {
  description = "Bucket prefixes with public read (bucket policy) and app read/write/delete."
  type        = list(string)
  default     = ["gallery/", "testimonios/"]
}

variable "allowed_origins" {
  description = "Origins allowed by CORS (admin uploads directly from the browser)."
  type        = list(string)
}

variable "enable_versioning" {
  description = "Versioning on the bucket."
  type        = bool
  default     = true
}

variable "tags" {
  description = "Tags."
  type        = map(string)
  default     = {}
}
