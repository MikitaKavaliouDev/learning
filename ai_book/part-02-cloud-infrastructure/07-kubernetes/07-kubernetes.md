# Глава 7: Kubernetes для AI-нагрузок — Умный паркинг

> **Ментальная модель:** *Парковка с зарядками для электромобилей.* Стандартная парковка принимает любые машины. Но если приезжает электрокар (тяжёлый сервис токенизации или эмбеддингов, требующий GPU), парковщик направляет его исключительно на специализированные места с мощными зарядными станциями. В Kubernetes эту роль выполняют Node Pools, Taints и Tolerations.

---

## 7.1. Почему Kubernetes критичен для AI

AI-сервисы в продакшене редко живут изолированно. Типичная архитектура включает:

- **Сервис инференса** — тяжёлый, требует GPU, долго грузит модель
- **Сервис эмбеддингов** — лёгкий, но чувствителен к задержкам
- **RAG-пайплайн** — комбинация CPU- и GPU-нагрузок
- **Бэкенд API** — стандартный Node.js/Python, без особых требований

Kubernetes (EKS в AWS, AKS в Azure) позволяет разместить все эти сервисы в одном кластере, но с разными политиками планирования. Без правильной конфигурации GPU-сервис может попасть на CPU-only ноду и упасть, а CPU-сервис — занять место, нужное для GPU-нагрузки.

---

## 7.2. Core Kubernetes: Pods, Deployments, Services, Ingress

### Pod — минимальная единица

В AI-контексте под может содержать:
- **Основной контейнер** с моделью
- **Sidecar** для мониторинга (Prometheus exporter) или предзагрузки модели
- **Init-контейнер** для скачивания весов модели перед стартом

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: llm-inference
  labels:
    app: inference
spec:
  containers:
    - name: inference
      image: my-ecr-repo/inference:latest
      ports:
        - containerPort: 8080
  initContainers:
    - name: download-model
      image: amazon/aws-cli
      command:
        - aws
        - s3
        - cp
        - "s3://models/llm-weights/"
        - "/models/"
      volumeMounts:
        - name: model-storage
          mountPath: /models
  volumes:
    - name: model-storage
      emptyDir: {}
```

### Deployment — управление replicas

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: embedding-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: embedding
  template:
    metadata:
      labels:
        app: embedding
    spec:
      containers:
        - name: embedding
          image: my-ecr-repo/embeddings:latest
          resources:
            requests:
              memory: "512Mi"
              cpu: "500m"
            limits:
              memory: "1Gi"
              cpu: "1"
```

### Service — стабильная точка входа

```yaml
apiVersion: v1
kind: Service
metadata:
  name: embedding-service
spec:
  selector:
    app: embedding
  ports:
    - port: 80
      targetPort: 8080
  type: ClusterIP
```

### Ingress — внешний доступ

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ai-api
  annotations:
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/listen-ports: '[{"HTTPS":443}]'
spec:
  rules:
    - host: api.salomon.ai
      http:
        paths:
          - path: /inference
            pathType: Prefix
            backend:
              service:
                name: inference-service
                port:
                  number: 80
```

---

## 7.3. GPU Node Pools: выделяем ресурсы для моделей

Стандартные ноды EKS (`t3.large`, `t3.xlarge`) не имеют GPU. Для инференса LLM нужны специализированные инстансы: `g5.xlarge`, `p4d.24xlarge`, `g4dn.xlarge`.

### Создание GPU Node Pool в EKS

```hcl
# Terraform-конфигурация GPU-нодгруппы
resource "aws_eks_node_group" "gpu" {
  cluster_name    = aws_eks_cluster.main.name
  node_group_name = "gpu-inference"
  instance_types  = ["g5.xlarge", "g5.2xlarge"]
  disk_size       = 100

  scaling_config {
    desired_size = 2
    max_size     = 10
    min_size     = 0  # Масштабирование до 0, когда нет задач
  }

  labels = {
    "workload" = "gpu"
  }

  taint {
    key    = "nvidia.com/gpu"
    value  = "true"
    effect = "NO_SCHEDULE"
  }
}
```

**Почему `min_size = 0`?** GPU-инстансы дороги (от $1/час за `g5.xlarge`). Если нет задач, требующих GPU, ноды масштабируются до нуля.

### Установка Nvidia GPU Operator

AWS EKS не имеет GPU-драйверов «из коробки». Для их установки используется Nvidia GPU Operator:

```bash
helm repo add nvidia https://helm.ngc.nvidia.com/nvidia
helm install gpu-operator nvidia/gpu-operator \
  --namespace gpu-operator \
  --create-namespace
```

После установки GPU-оператор автоматически обнаруживает физические GPU на нодах и пробрасывает их в контейнеры.

---

## 7.4. Taints, Tolerations и Node Affinity

**Taint** — метка на ноде, которая отталкивает поды, не имеющие соответствующей **Toleration**.

```bash
# Наносим taint на GPU-ноду
kubectl taint nodes g5-xl-123 nvidia.com/gpu=true:NoSchedule
```

**Toleration** — разрешение для пода быть запланированным на «запятнанную» ноду:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: llm-inference
spec:
  template:
    spec:
      containers:
        - name: inference
          image: my-ecr-repo/llm:latest
          # Запрашиваем GPU
          resources:
            limits:
              nvidia.com/gpu: 1
      tolerations:
        - key: "nvidia.com/gpu"
          operator: "Equal"
          value: "true"
          effect: "NoSchedule"
```

**Node Affinity** — более гибкий механизм: под *предпочитает* или *требует* размещения на определённых нодах:

```yaml
spec:
  affinity:
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
          - matchExpressions:
              - key: workload
                operator: In
                values:
                  - cpu-intensive
      preferredDuringSchedulingIgnoredDuringExecution:
        - weight: 50
          preference:
            matchExpressions:
              - key: topology.kubernetes.io/zone
                operator: In
                values:
                  - eu-central-1a
```

**Итоговая стратегия для AI-кластера:**

| Тип сервиса  | Node Pool     | Taint            | Toleration |
|-------------|---------------|------------------|------------|
| LLM-инференс | GPU (`g5.xlarge`) | `nvidia.com/gpu=true:NoSchedule` | Да |
| Эмбеддинги   | GPU (меньший `g4dn`) | `nvidia.com/gpu=true:NoSchedule` | Да |
| Бэкенд API   | CPU (`t3.large`) | Нет | Нет |
| Redis/БД     | CPU с большим RAM | Нет | Нет |

---

## 7.5. HPA с кастомными Prometheus-метриками

Стандартный HPA по CPU/Memory плохо подходит для AI-сервисов. LLM-инференс может потреблять 100% GPU памяти, но почти 0% CPU. Решение: кастомные метрики на основе очереди запросов.

### Установка Prometheus Adapter

```yaml
# prometheus-adapter-values.yaml
rules:
  custom:
    - seriesQuery: 'request_queue_depth{namespace="ai"}'
      resources:
        overrides:
          namespace: { resource: "namespace" }
          pod: { resource: "pod" }
      metricsQuery: 'avg(request_queue_depth) by (namespace, pod)'
```

### HPA на основе глубины очереди

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: inference-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: llm-inference
  minReplicas: 1
  maxReplicas: 20
  metrics:
    - type: Pods
      pods:
        metric:
          name: request_queue_depth
        target:
          type: AverageValue
          averageValue: "5" # Масштабируем, когда в очереди >5 запросов на под
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
```

**Почему конкуренция очереди, а не CPU?** LLM-сервис может обрабатывать 1 запрос с GPU, а 50 запросов ждать в памяти процесса. CPU будет низким (GPU делает работу), но latency растёт. `request_queue_depth` точнее отражает реальную загрузку.

---

## 7.6. Liveness и Readiness Probes для стриминговых сервисов

Стриминговые сервисы (SSE, WebSockets) имеют особые требования к пробам:

- **LivenessProbe** — перезапускает под, если Event Loop заблокирован
- **ReadinessProbe** — убирает под из Service, если он не готов принимать трафик
- **StartupProbe** — даёт время на загрузку модели (до 5 минут)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: streaming-inference
spec:
  template:
    spec:
      containers:
        - name: inference
          image: my-ecr-repo/streaming:latest
          ports:
            - containerPort: 3000
          startupProbe:
            httpGet:
              path: /healthz
              port: 3000
            initialDelaySeconds: 0
            periodSeconds: 10
            failureThreshold: 30 # 5 минут на загрузку модели
          livenessProbe:
            httpGet:
              path: /healthz
              port: 3000
            initialDelaySeconds: 0
            periodSeconds: 10
            failureThreshold: 3  # 30 секунд без ответа = kill
          readinessProbe:
            httpGet:
              path: /ready
              port: 3000
            initialDelaySeconds: 0
            periodSeconds: 5
            failureThreshold: 1
```

**Критический паттерн для Node.js:** Если Event Loop заблокирован (например, синхронной токенизацией длинного текста), `httpGet` проба не ответит, потому что HTTP-сервер не обрабатывает новые соединения. Но стандартный `exec` probe с `node -e "..."` обходит эту проблему:

```yaml
livenessProbe:
  exec:
    command:
      - node
      - -e
      - |
        try {
          require('http').get('http://localhost:3000/healthz', (r) => {
            process.exit(r.statusCode === 200 ? 0 : 1);
          });
        } catch { process.exit(1); }
  periodSeconds: 5
```

---

## 💬 Каверзный вопрос на интервью

> *«У вас 3 пода с open-source моделью. Pod A в `CrashLoopBackOff`, Pod B потребляет 99% GPU памяти и сбрасывает соединения, Pod C простаивает, но отказывается принимать новый трафик. Что не так с вашими Liveness и Readiness Probes?»*

**Архитектурный разбор:**

1. **Pod A (`CrashLoopBackOff`):** Модель не успевает загрузиться за время `initialDelaySeconds`. Решение — добавить `startupProbe` с `failureThreshold: 30` (5 минут = 30 попыток × 10 секунд). Без `startupProbe` liveness убивает под до того, как модель загрузилась.

2. **Pod B (99% GPU, сброс соединений):** LivenessProbe настроен на CPU или HTTP, но GPU-память не мониторится. Решение — кастомный endpoint `/gpu-health`, проверяющий через Nvidia Management Library (NVML), сколько памяти свободно. Если >90% занято, возвращать 503 — K8s перезапустит под.

3. **Pod C (простаивает, не принимает трафик):** `readinessProbe` проверяет не то, что нужно. Например, проверяет наличие модели в памяти (модель есть), но не проверяет, готов ли HTTP-сервер принимать соединения. Решение — проверять `/ready` с вызовом `db.$queryRaw\`SELECT 1\`` и проверкой пула соединений, а не просто `200 OK`.
