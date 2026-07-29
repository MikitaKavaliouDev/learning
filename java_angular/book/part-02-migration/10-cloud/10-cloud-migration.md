# Глава 10: Облачная миграция (Cloud Migration)

> «Lift & Shift — это не cloud-native. Это просто аренда сервера в другом датацентре» — *рефрен архитекторов на cloud-конференциях.*

После миграции стека (Java 21, Angular 20) и архитектурной декомпозиции (микросервисы) следующим шагом стал переезд в облако. Эта глава рассказывает о стратегиях, инструментах и подводных камнях облачной миграции enterprise-приложения.

---

## 10.1. Облачные провайдеры: Сравнение

### AWS vs Azure vs GCP

| Критерий | AWS | Azure | GCP |
|---------|-----|-------|-----|
| **Рыночная доля во Франции** | ~60% (Крупные банки, BNP, Société Générale) | ~15% (STMicroelectronics, госсектор) | ~5% (Стартапы) |
| **Kubernetes** | EKS (зрелый) | AKS (хорошая интеграция с .NET) | GKE (самый зрелый, авто-масштабирование) |
| **Serverless** | Lambda (лидер) | Azure Functions | Cloud Functions |
| **Managed PostgreSQL** | RDS / Aurora | Azure Database for PostgreSQL | Cloud SQL |
| **IAM** | IAM Roles — эталон | Azure AD (интеграция с Office 365) | Cloud IAM |
| **Популярность во Франции** | **Высокая** (стандарт в банках) | **Средняя** (промышленность) | **Низкая** |

### Наш выбор: AWS

Основные причины:

1. **STMicroelectronics** — клиент в нашем проекте использовал AWS.
2. **Зрелость сервисов** — RDS (PostgreSQL), EKS (Kubernetes), MSK (Kafka).
3. **IAM** — лучшая система ролей и политик в индустрии.
4. **Французские регионы** — `eu-west-3` (Paris), `eu-west-1` (Ireland).

---

## 10.2. Lift & Shift vs Cloud-Native

### Lift & Shift (Rehost)

«Переносим as-is» — забираем виртуалку из датацентра и запускаем её в облаке (EC2).

**Плюсы:**
- Минимальные изменения кода.
- Быстрый переезд (недели, а не месяцы).
- Снижение CAPEX (не нужно покупать серверы).

**Минусы:**
- Не используем преимущества облака (auto-scaling, managed services).
- Платим за виртуалки 24/7, даже если нагрузка нулевая.
- Операционные расходы (OPEX) выше, чем On-Premise.

### Cloud-Native (Re-architect)

Полностью переписываем приложение под облачные сервисы.

**Плюсы:**
- Auto-scaling, pay-per-use, managed services.
- Глобальная доступность, multi-region.
- Resilience (K8s self-healing, HA).

**Минусы:**
- Дорого и долго.
- Vendor lock-in.
- Требует DevOps-культуры.

### Наш подход: Tiers of Migration

Мы не выбирали между Lift & Shift и Cloud-Native — мы сделали **гибрид**:

```
Tier 1: База данных → RDS (Aurora PostgreSQL)
Tier 2: Backend → EKS (Docker + Kubernetes)
Tier 3: Frontend → S3 + CloudFront (SPA hosting)
Tier 4: Очереди → MSK (Managed Kafka)
Tier 5: Кэш → ElastiCache (Redis)
```

Каждый tier двигался независимо.

---

## 10.3. Docker: Контейнеризация Legacy-приложения

### Сборка Docker-образа

До миграции приложение собиралось в WAR и деплоилось на Tomcat/JBoss. Мы перевели всё в Docker:

```dockerfile
# Stage 1: Build
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn clean package -DskipTests

# Stage 2: Run
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar

# Пользователь без root-прав (security best practice)
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD curl -f http://localhost:8080/actuator/health || exit 1

ENTRYPOINT ["java", "-jar", "app.jar"]
```

### Multi-stage build — почему это важно

- **Безопасность** — JDK не попадает в финальный образ, только JRE.
- **Размер** — 80 MB против 350 MB (одностроечная сборка).
- **CVE** — Alpine Linux имеет меньше уязвимостей, чем полный JDK образ.

### Docker Compose для локальной разработки

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: myapp
      POSTGRES_USER: app
      POSTGRES_PASSWORD: secret
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  kafka:
    image: confluentinc/cp-kafka:latest
    ports:
      - "9092:9092"
    environment:
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092

  app:
    build: .
    ports:
      - "8080:8080"
    environment:
      SPRING_DATASOURCE_URL: jdbc:postgresql://postgres:5432/myapp
      SPRING_KAFKA_BOOTSTRAP_SERVERS: kafka:9092
    depends_on:
      - postgres
      - kafka

volumes:
  pgdata:
```

---

## 10.4. Kubernetes: Оркестрация

### Зачем K8s после Docker

Docker Compose хорош для локальной разработки и одного сервера. Для production-кластера нужен:

- **Self-healing** — перезапуск упавшего контейнера.
- **Auto-scaling** — увеличение реплик при нагрузке.
- **Rolling updates** — zero-downtime деплой.
- **Service discovery** — DNS-балансировка между сервисами.

### Helm Charts

Для управления конфигурацией K8s мы использовали **Helm**:

```yaml
# values.yaml — конфигурация сервиса
service:
  name: order-service
  replicas: 3
  image:
    repository: myregistry/order-service
    tag: latest
  resources:
    requests:
      cpu: "500m"
      memory: "512Mi"
    limits:
      cpu: "2"
      memory: "2Gi"
  probes:
    liveness:
      path: /actuator/health/liveness
      initialDelaySeconds: 30
    readiness:
      path: /actuator/health/readiness
      initialDelaySeconds: 15
```

```yaml
# templates/deployment.yaml (Helm-шаблон)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ .Values.service.name }}
spec:
  replicas: {{ .Values.service.replicas }}
  selector:
    matchLabels:
      app: {{ .Values.service.name }}
  template:
    metadata:
      labels:
        app: {{ .Values.service.name }}
    spec:
      containers:
        - name: {{ .Values.service.name }}
          image: {{ .Values.service.image.repository }}:{{ .Values.service.image.tag }}
          ports:
            - containerPort: 8080
          livenessProbe:
            httpGet:
              path: {{ .Values.service.probes.liveness.path }}
              port: 8080
            initialDelaySeconds: {{ .Values.service.probes.liveness.initialDelaySeconds }}
          readinessProbe:
            httpGet:
              path: {{ .Values.service.probes.readiness.path }}
              port: 8080
            initialDelaySeconds: {{ .Values.service.probes.readiness.initialDelaySeconds }}
          resources:
            requests:
              cpu: {{ .Values.service.resources.requests.cpu }}
              memory: {{ .Values.service.resources.requests.memory }}
```

### Ingress Controller (Traffic Routing)

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: api-ingress
  annotations:
    ingress.kubernetes.io/ssl-redirect: "true"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - api.myapp.com
      secretName: api-tls
  rules:
    - host: api.myapp.com
      http:
        paths:
          - path: /api/orders
            pathType: Prefix
            backend:
              service:
                name: order-service
                port:
                  number: 8080
          - path: /api/billing
            pathType: Prefix
            backend:
              service:
                name: billing-service
                port:
                  number: 8080
```

> **Подводный камень (Gotcha):** Не используйте `Ingress` без `readinessProbe`. При rolling update K8s будет отправлять трафик на ещё не запустившийся pod. Readiness probe гарантирует, что pod получает трафик только после того, как Spring контекст полностью поднялся.

---

## 10.5. Базы данных в облаке

### Amazon RDS / Aurora

AWS RDS (Relational Database Service) — managed PostgreSQL.

**Преимущества:**
- Multi-AZ (автоматический failover между датацентрами).
- Automated backups (point-in-time recovery).
- Read replicas (масштабирование чтения).
- Performance Insights (мониторинг запросов).

**Настройка production RDS:**

```yaml
# Terraform: RDS Instance
resource "aws_db_instance" "main" {
  identifier     = "myapp-${var.environment}"
  engine         = "postgres"
  engine_version = "16.3"
  instance_class = "db.r6g.large"
  
  db_name  = "myapp"
  username = "admin"
  password = random_password.master.result

  storage_type      = "gp3"
  allocated_storage = 100

  multi_az               = true
  backup_retention_period = 30
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:04:00-sun:05:00"

  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name

  enabled_cloudwatch_logs_exports = ["postgresql"]
  performance_insights_enabled    = true
}
```

### Connection Pooling с PgBouncer

Для эффективного управления коннектами в Kubernetes используем **PgBouncer** (connection pooler):

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: pgbouncer
spec:
  replicas: 2
  selector:
    matchLabels:
      app: pgbouncer
  template:
    metadata:
      labels:
        app: pgbouncer
    spec:
      containers:
        - name: pgbouncer
          image: bitnami/pgbouncer:latest
          env:
            - name: POSTGRESQL_HOST
              value: myapp-rds.cluster-xxx.eu-west-3.rds.amazonaws.com
            - name: PGBOUNCER_DEFAULT_POOL_SIZE
              value: "25"
```

---

## 10.6. IAM, Security Groups, VPC, Secrets Manager

### VPC (Virtual Private Cloud)

Мы развернули приложение в изолированной VPC:

```
VPC: 10.0.0.0/16
├── Public Subnets (Internet-facing)
│   └── Load Balancer, NAT Gateway
├── Private Subnets (Application)
│   └── EKS worker nodes, RDS, MSK
└── Database Subnets (Isolated)
    └── RDS (multi-AZ), ElastiCache
```

### Security Groups

```
SG_LoadBalancer: HTTP/HTTPS from 0.0.0.0/0
SG_App: TCP 8080 from SG_LoadBalancer
SG_RDS: TCP 5432 from SG_App
SG_Kafka: TCP 9092 from SG_App
SG_Redis: TCP 6379 from SG_App
```

### IAM Roles (Principle of Least Privilege)

```yaml
# IAM Role для EKS worker node
resource "aws_iam_role" "node_role" {
  assume_role_policy = data.aws_iam_policy_document.eks_assume.json
}

resource "aws_iam_policy" "node_policy" {
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:BatchCheckLayerAvailability"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = "arn:aws:secretsmanager:*:*:secret:myapp-*"
      }
    ]
  })
}
```

### Secrets Manager

Храним секреты (пароли БД, JWT-ключи, API-ключи) в **AWS Secrets Manager**:

```java
@Configuration
public class SecretsConfig {

    @Bean
    public DataSource dataSource() {
        // Spring Boot 3 поддерживает автоматическое получение секретов
        // из AWS Secrets Manager
        return DataSourceBuilder.create()
            .url("jdbc:postgresql://${DB_HOST}:5432/myapp")
            .username("${DB_USERNAME}")
            .password("${DB_PASSWORD}")
            .build();
    }
}
```

---

## 10.7. CI/CD в облаке: GitHub Actions + Docker + K8s

### Pipeline

```
[Push to main] → [GitHub Actions] → [Build Docker Image] → [Push to ECR]
    → [Helm Deploy to EKS] → [Smoke Tests] → [Success]
```

### GitHub Actions Workflow

```yaml
name: Deploy to EKS

on:
  push:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Set up JDK 21
        uses: actions/setup-java@v4
        with:
          java-version: '21'
          distribution: 'temurin'

      - name: Build with Maven
        run: mvn -B package

      - name: Build Docker image
        run: |
          docker build -t ${{ vars.ECR_REGISTRY }}/order-service:${{ github.sha }} .
          docker tag ${{ vars.ECR_REGISTRY }}/order-service:${{ github.sha }} \
            ${{ vars.ECR_REGISTRY }}/order-service:latest

      - name: Push to ECR
        uses: aws-actions/amazon-ecr-login@v2
        with:
          registry-type: private
      - run: |
          docker push ${{ vars.ECR_REGISTRY }}/order-service:${{ github.sha }}
          docker push ${{ vars.ECR_REGISTRY }}/order-service:latest

      - name: Deploy to EKS
        uses: bitovi/github-actions-deploy-eks-helm@v1
        with:
          cluster-name: myapp-eks
          namespace: production
          name: order-service
          values: deployments/order-service/values.yaml
          image-tag: ${{ github.sha }}
```

---

## 10.8. Auto-scaling и Load Balancing

### Horizontal Pod Autoscaler (HPA)

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: order-service-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: order-service
  minReplicas: 3
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
```

### Cluster Autoscaler

HPA увеличивает количество pod-ов, но если ресурсов кластера не хватает — **Cluster Autoscaler** добавляет ноды:

```yaml
# AWS EKS Managed Node Group
resource "aws_eks_node_group" "main" {
  cluster_name    = aws_eks_cluster.main.name
  node_group_name = "main-ng"
  instance_types  = ["r6i.large", "r6a.large", "r6g.large"]  # Spot instances
  scaling_config {
    desired_size = 3
    min_size     = 3
    max_size     = 30
  }
}
```

### Load Balancing (ALB)

AWS Application Load Balancer (ALB) маршрутизирует внешний трафик:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  annotations:
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/listen-ports: '[{"HTTP": 80}, {"HTTPS": 443}]'
```

---

## 10.9. Cloud Cost Optimization

### Как мы оптимизировали расходы

До оптимизации: **$4,200/мес.** → После: **$1,800/мес.**

| Метод | Экономия | Описание |
|-------|---------|----------|
| **Spot Instances** | 60–70% | Для stateless worker nodes (EKS) |
| **Auto-scaling** | 30–50% | HPA по CPU/memory, scale to zero в non-peak |
| **RDS Reserved Instances** | 40% | 3-летние reserved для production |
| **S3 Lifecycle Policies** | 20% | Старые логи → Glacier после 30 дней |
| **Graviton (ARM)** | 20% | Миграция на ARM-инстансы (r6g вместо r5) |
| **EBS gp3** | 20% | Замена io1/gp2 на gp3 |

### Cost Allocation Tags

Каждый ресурс AWS помечен тегами:

```yaml
tags = {
  Environment = "production"
  Service     = "order-service"
  Team        = "backend"
  CostCenter  = "platform-engineering"
}
```

---

## 10.10. Disaster Recovery и Multi-region

### RTO и RPO

| Метрика | Цель | Достигнуто |
|---------|------|-----------|
| **RTO (Recovery Time Objective)** | < 1 час | ~15 мин |
| **RPO (Recovery Point Objective)** | < 15 мин | ~5 мин |

### Multi-region архитектура (Active-Passive)

```
eu-west-3 (Paris) — Primary
└── EKS, RDS Primary, MSK Primary

eu-west-1 (Ireland) — DR (Standby)
└── RDS Read Replica, EKS (minimal nodes)
```

**Процедура переключения (DR Drill):**

```bash
# 1. Promote RDS Read Replica to Primary
aws rds promote-read-replica --db-instance-identifier myapp-dr

# 2. Update Route53 failover
aws route53 change-resource-record-sets --change-batch '{
  "Changes": [{
    "Action": "UPSERT",
    "ResourceRecordSet": {
      "Name": "api.myapp.com",
      "Type": "A",
      "Failover": "PRIMARY",
      "SetIdentifier": "dr"
    }
  }]
}'

# 3. Scale up DR EKS cluster
kubectl scale deployment --all --replicas=10 -n production
```

---

## 10.11. Как рассказать про Cloud на Senior-интервью

### Готовые формулировки

**Вопрос:** «Какой у вас опыт с облаком?»

> «Я участвовал в полной cloud-миграции enterprise-приложения на AWS. Мы прошли путь от Lift & Shift (перенос монолита на EC2) до cloud-native архитектуры на EKS с RDS Aurora, MSK Kafka и ElastiCache. Ключевым принципом был **Tiered Migration** — каждый слой (БД, бэкенд, фронтенд, кэш) мигрировался независимо.»

**Вопрос:** «Что было самым сложным?»

> «Самым сложным было перепроектирование **работы с состоянием**: в облаке нельзя полагаться на локальный IP или файловую систему. Мы перевели сессии в Redis (ElastiCache), файлы — в S3, логи — в CloudWatch. Также пришлось пересмотреть **Security Groups и IAM** — в облаке нет периметра безопасности, как в датацентре.»

**Вопрос:** «Как контролировали затраты?»

> «У нас была Cost Allocation по тегам (Environment, Service, Team). Мы использовали Spot Instances для stateless workers, Auto-scaling по нагрузке и Reserved Instances для RDS. Результат — снижение месячных затрат с $4,200 до $1,800.»

### Cloud-термины для собеседования (французский контекст)

| Термин | Значение |
|--------|----------|
| **Infrastructure as Code (IaC)** | Terraform / Pulumi для описания инфраструктуры |
| **Immutable Infrastructure** | Не изменяем сервер после деплоя — пересоздаём |
| **Twelve-Factor App** | Методология cloud-native приложений |
| **Stateless** | Сервис не хранит состояние локально |
| **Multi-AZ** | Размещение в нескольких зонах доступности |
| **Blue-Green Deployment** | Два идентичных окружения, переключение трафика |
| **Chaos Engineering** | Преднамеренное внесение сбоев для проверки resilience |

---

> **Подводный камень (Gotcha):** Если на собеседовании вас спросят про Cloud, **не начинайте с Kubernetes**. Сначала скажите про **Tiered Migration** (Lift & Shift → Cloud-Native постепенно) и **Twelve-Factor App**. K8s упомяните как инструмент, но не как цель. Французские архитекторы ценят прагматизм: «Знаем, что K8s — это сложно, поэтому выбираем managed сервисы AWS».

---

**Что дальше:** В Главе 11 — собираем всё вместе в финальный pitch для собеседования.
