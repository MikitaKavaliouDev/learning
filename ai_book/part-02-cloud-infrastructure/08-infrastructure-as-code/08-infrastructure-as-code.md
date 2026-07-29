# Глава 8: Инфраструктура как код (IaC) — Архитектурный чертёж

> **Ментальная модель:** *Цифровая модель горной хижины.* Мы не строим приют на склоне вслепую, угадывая расположение балок. Мы создаём точную 3D-модель, которая автоматически рассчитывает количество материалов. Если хижину снесёт лавиной, мы нажмём одну кнопку, и роботы воссоздадут её в точности до миллиметра в другом безопасном месте.

---

## 8.1. ClickOps — главный враг продакшена

«ClickOps» — это управление инфраструктурой через веб-консоль AWS (или Azure/GCP). Инженер заходит в панель управления, создаёт SQS-очередь через интерфейс, настраивает правила, а через месяц никто не помнит, какие именно параметры были выбраны.

**Проблемы ClickOps в AI-инфраструктуре:**

- **Не воспроизводится:** Если кластер EKS выйдет из строя, восстановить его вручную займёт дни.
- **Документация не синхронизирована:** Настройки OpenSearch (количество шардов, размер инстанса) меняются в консоли, но IaC-код этого не отражает.
- **Аудит невозможен:** Кто и когда изменил security group для векторной базы данных?
- **Дрейф конфигурации:** Инфраструктура «расползается» — прод отличается от стейджинга.

**Решение:** Декларативное описание всей инфраструктуры в Terraform, где файлы — единственный источник правды (Source of Truth).

---

## 8.2. Основы Terraform: провайдеры, ресурсы, состояние

### 8.2.1. Провайдеры

```hcl
# providers.tf
terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Environment = var.environment
      Project     = "salomon-ai"
      ManagedBy   = "terraform"
    }
  }
}
```

### 8.2.2. Декларативные ресурсы

```hcl
# main.tf — объявляем, ЧТО должно существовать, а не КАК создать
resource "aws_sqs_queue" "inference_queue" {
  name                        = "${var.environment}-inference-queue"
  delay_seconds               = 0
  max_message_size            = 262144  # 256KB
  message_retention_seconds   = 86400   # 1 день
  visibility_timeout_seconds  = 300     # 5 минут для LLM-запроса

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.inference_dlq.arn
    maxReceiveCount     = 3
  })
}

resource "aws_sqs_queue" "inference_dlq" {
  name = "${var.environment}-inference-dlq"
}
```

### 8.2.3. State — файл состояния

Terraform хранит карту соответствия между декларативным кодом и реальными ресурсами в **state-файле**. Если state потерян, Terraform не сможет управлять существующей инфраструктурой.

**Правильное хранение state — S3 + DynamoDB для блокировки:**

```hcl
# backend.tf
terraform {
  backend "s3" {
    bucket         = "salomon-tf-state"
    key            = "ai-infrastructure/terraform.tfstate"
    region         = "eu-central-1"
    dynamodb_table = "terraform-state-locks"
    encrypt        = true
  }
}
```

```hcl
# Сам DynamoDB для блокировок создаётся отдельной командой
resource "aws_dynamodb_table" "terraform_locks" {
  name         = "terraform-state-locks"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"
  attribute {
    name = "LockID"
    type = "S"
  }
}
```

---

## 8.3. Модульный Terraform для AI-инфраструктуры

Вместо одного гигантского `main.tf` разбиваем инфраструктуру на модули с чёткими границами ответственности.

### Структура директорий

```
terraform/
├── environments/
│   ├── dev/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── terraform.tfvars
│   ├── staging/
│   └── prod/
├── modules/
│   ├── networking/        # VPC, subnets, security groups
│   ├── eks/               # EKS cluster + node groups
│   ├── rds/               # PostgreSQL + pgvector
│   ├── opensearch/        # OpenSearch domain
│   ├── sqs/               # SQS queues + DLQs
│   └── monitoring/        # Prometheus + CloudWatch
└── providers.tf
```

### Модуль RDS для векторов (pgvector)

```hcl
# modules/rds/main.tf
resource "aws_db_instance" "pgvector" {
  identifier = "${var.environment}-pgvector"

  engine         = "postgres"
  engine_version = "16.3"
  instance_class = var.instance_class

  db_name  = "ai_vectors"
  username = var.db_username
  password = var.db_password

  # Включение расширения pgvector (требуется параметр)
  parameter_group_name = aws_db_parameter_group.pgvector.name

  storage_type      = "gp3"
  allocated_storage = var.storage_gb

  backup_retention_period = var.backup_retention_days
  deletion_protection     = var.environment == "prod" ? true : false

  vpc_security_group_ids = [var.security_group_id]
  db_subnet_group_name   = var.subnet_group_name

  enabled_cloudwatch_logs_exports = ["postgresql"]
}

resource "aws_db_parameter_group" "pgvector" {
  name   = "${var.environment}-pgvector-pg"
  family = "postgres16"

  parameter {
    name  = "shared_preload_libraries"
    value = "vector"
  }
}
```

### Модуль OpenSearch для гибридного поиска

```hcl
# modules/opensearch/main.tf
resource "aws_opensearch_domain" "search" {
  domain_name    = "${var.environment}-ai-search"
  engine_version = "OpenSearch_2.11"

  cluster_config {
    instance_type  = var.instance_type
    instance_count = var.instance_count

    zone_awareness_enabled = var.instance_count > 1
  }

  ebs_options {
    ebs_enabled = true
    volume_size = var.storage_gb
    volume_type = "gp3"
  }

  encrypt_at_rest {
    enabled = true
  }

  node_to_node_encryption {
    enabled = true
  }

  domain_endpoint_options {
    enforce_https       = true
    tls_security_policy = "PTLS"
  }
}
```

### Использование модулей в окружении

```hcl
# environments/prod/main.tf
module "networking" {
  source = "../../modules/networking"
  environment = "prod"
  vpc_cidr   = "10.0.0.0/16"
}

module "rds" {
  source = "../../modules/rds"
  environment = "prod"
  instance_class = "db.r6g.large"  # Graviton с большим RAM
  storage_gb     = 500
  security_group_id = module.networking.rds_security_group_id
  subnet_group_name = module.networking.db_subnet_group
}

module "opensearch" {
  source = "../../modules/opensearch"
  environment  = "prod"
  instance_type  = "r6g.large.search"
  instance_count = 3
  storage_gb     = 1000
}
```

---

## 8.4. Управление State и борьба с дрейфом

**Дрейф (Infrastructure Drift)** — расхождение между тем, что описано в Terraform, и тем, что реально существует в облаке. Возникает, когда кто-то вручную меняет ресурсы через консоль AWS.

### Обнаружение дрейфа

```bash
# Сравнить state с реальной инфраструктурой
terraform plan -detailed-exitcode

# Или в CI/CD — автоматическая проверка при каждом PR
# Github Actions: terraform plan → если exit code 2 (есть изменения), блокировать merge
```

### Восстановление после дрейфа

```hcl
# Вариант 1: Импортировать существующий ресурс обратно в state
terraform import aws_sqs_queue.inference_queue <queue-url>

# Вариант 2: Обновить state до текущего состояния (с потерей управления)
terraform refresh

# Вариант 3: taint — пересоздать конкретный ресурс (осторожно!)
terraform taint aws_sqs_queue.inference_queue
```

### State Locking: защита от конкурентных изменений

Когда команда работает над инфраструктурой, два инженера могут одновременно запустить `terraform apply` — это приведёт к повреждению state-файла. DynamoDB блокирует state на время операции:

```bash
$ terraform apply
# DynamoDB создаёт запись с LockID
# Другой инженер пытается запустить apply — получает ошибку:
╷
│ Error: Error acquiring the state lock
│ Lock Info:
│   ID:        12345678-abcd
│   Path:      salomon-tf-state/ai-infrastructure/terraform.tfstate
│   Operation: OperationApply
│   Who:       another-engineer@company.com
│   Version:   1.6.0
│   Created:   2025-11-20 14:32:10.123 +0000 UTC
╵
```

---

## 8.5. Пайплайн IaC в CI/CD

```yaml
# .github/workflows/deploy-infra.yaml
name: Deploy AI Infrastructure

on:
  pull_request:
    paths:
      - "terraform/**"
  push:
    branches:
      - main
    paths:
      - "terraform/**"

jobs:
  plan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3

      - name: Terraform Init
        run: terraform init
        working-directory: terraform/environments/${{ github.ref_name == 'main' && 'prod' || 'dev' }}

      - name: Terraform Format
        run: terraform fmt -check
        working-directory: terraform/environments/${{ github.ref_name == 'main' && 'prod' || 'dev' }}

      - name: Terraform Plan
        run: terraform plan
        working-directory: terraform/environments/${{ github.ref_name == 'main' && 'prod' || 'dev' }}

  apply:
    if: github.ref == 'refs/heads/main'
    needs: plan
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3

      - name: Terraform Apply
        run: terraform apply -auto-approve
        working-directory: terraform/environments/prod
```

---

## 8.6. Но это же просто «ещё один YAML»?

Terraform-код — это **живая документация**. Любой новый инженер, заходя в проект, видит полную архитектуру инфраструктуры, читая `main.tf`. Нет необходимости в вики-страницах, которые устаревают через неделю.

**Ключевые метрики качества IaC:**

| Метрика | Хорошо | Плохо |
|---------|--------|-------|
| Время развёртывания стейджинга из нуля | <15 минут | Дни |
| Дрейф между стейджингом и продом | 0 ресурсов | Любые различия |
| Количество модулей | 5–10 (чистая абстракция) | 1 (всё в одном) или 100 (оверинжиниринг) |
| Применение в CI/CD | Автоматически | Ручной `terraform apply` |

---

## 💬 Каверзный вопрос на интервью

> *«Инженер вручную удалил индекс векторного поиска из панели AWS OpenSearch, чтобы быстро исправить баг в пятницу вечером. Теперь Terraform-пайплайн падает с критической ошибкой рассинхронизации. Опишите пошаговый процесс восстановления инфраструктуры без уничтожения работающей базы данных пользователей.»*

**Пошаговый процесс восстановления:**

1. **Диагностика:** Запустить `terraform plan` — он покажет, что OpenSearch-домен существует, но индекс удалён. Terraform хочет пересоздать домен целиком (что уничтожит данные!).

2. **Изоляция:** Сделать снапшот OpenSearch-домена через консоль AWS (Manual Snapshot), чтобы подстраховать существующие данные.

3. **Импорт в state:** Использовать `terraform import aws_opensearch_domain.search <domain-name>` для синхронизации state с реальным доменом.

4. **Terraform refresh:** Запустить `terraform refresh`, чтобы обновить state до текущей конфигурации (без удаления домена).

5. **Plan verification:** Запустить `terraform plan` — теперь план должен показать только создание индекса (если он был описан в конфигурации), а не пересоздание домена.

6. **Apply:** Запустить `terraform apply` для восстановления индекса.

**Профилактика:** Добавить `deletion_protection = true` на критичные ресурсы, настроить оповещение CloudTrail на удаление ресурсов, внедрить процесс Change Management (даже для «быстрых фиксов»).
