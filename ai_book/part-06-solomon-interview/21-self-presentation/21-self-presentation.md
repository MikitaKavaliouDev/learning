# Глава 21: Self-Presentation — Самопрезентация для интервью Salomon

> **Источники:** my_history.md (732 строки), job-specific-prep.md — полные скрипты презентации на французском и английском

## 10-Minute Presentation Script

### Структура тайминга

| Time | Секция | Цель |
|------|--------|------|
| 0:00–1:30 | **Accroche** | Установить identity, stack fit, задать agenda вокруг Enablement |
| 1:30–5:30 | **Le cas BaseSystem** | Развернуть проект как мини-историю: RAG + Agents + HITL + CI/CD + Bedrock |
| 5:30–7:30 | **Socle technique transférable** | Явно привязать навыки к пунктам job description |
| 7:30–9:00 | **Volet SDK/plateforme** | Связать startup опыт с Shared Component Library Salomon |
| 9:00–10:00 | **Clôture** | Сильный closing: почему этот пост, открыть Q&A |

---

### Script complet en français (полный сценарий на французском)

#### 1. Accroche (0:00 – 1:30)

> **«Bonjour à tous. Je suis Mikita Kavaliou, ingénieur logiciel Senior spécialisé en ingénierie LLM et architectures IA. Cela fait plus de deux ans que je me consacre exclusivement à l'industrialisation de systèmes IA en production — principalement des architectures RAG, des agents autonomes et des frameworks d'évaluation.**
>
> **Mon écosystème principal est TypeScript et Node.js, combiné avec le SDK AWS Bedrock et l'API native d'Anthropic pour les modèles Claude. Ce qui définit mon approche, c'est l'application rigoureuse des principes de génie logiciel (clean architecture, typage strict, CI/CD) à l'IA générative pour garantir la fiabilité, la performance et la réutilisabilité du code.**
>
> Plutôt que de parcourir mon CV de façon chronologique, je vais utiliser ces 10 minutes pour vous montrer comment mon expérience en production se traduit directement sur la mission Enablement chez Salomon.
>
> Une équipe Enablement réussit quand elle accomplit deux choses :
> 1. Construire des patterns architecturaux AI robustes et prêts pour la production, de bout en bout.
> 2. Standardiser ces patterns dans des librairies partagées pour que les équipes produit à travers l'organisation puissent adopter l'IA de manière sûre et rapide.
>
> Dans les prochaines minutes, je vais vous présenter un projet phare où j'ai construit cet exact stack, expliquer les fondations techniques transférables, montrer comment j'empaquète ces systèmes en SDK partagés, et expliquer pourquoi ce rôle chez Salomon correspond exactement à mon expertise.»**

#### 2. Le cas fil rouge : BaseSystem (1:30 – 5:30)

> **«Pour illustrer cela concrètement, le projet le plus représentatif de mon parcours est ma mission récente chez BaseSystem, un éditeur de logiciels de billetterie pour les stations de ski en Pologne.**
>
> **L'objectif était de moderniser une base de code existante en y intégrant une suite de produits IA end-to-end. J'ai conçu et déployé l'architecture globale en TypeScript sur AWS Bedrock avec Claude 3.5 Sonnet.**
>
> **Le projet comportait trois volets majeurs :**
>
> **1. Un moteur RAG métier :** Pour interroger la réglementation des stations, la météo et les polices d'assurance. J'ai mis en place une stratégie de chunking adaptée et un re-ranking avec BGE / Cohere pour ne sélectionner que les 5 extraits les plus pertinents avant d'injecter le contexte dans Claude.
>
> **2. Des agents décisionnels en Tool-Calling :** Des agents capables d'interroger les API REST métier en temps réel pour vérifier la disponibilité des billets ou calculer des remises prédictives.
>
> **3. Un pattern Human-in-the-Loop :** Pour les cas sensibles comme les demandes de remboursement. Si l'agent détecte une intention de remboursement, la session est figée en base de données, et une requête interactive est envoyée dans Slack via le Block Kit API. Un opérateur valide ou ajuste l'action en un clic, ce qui libère le webhook et finalise la transaction.
>
> **Enfin, l'ensemble a été industrialisé avec GitLab CI, où chaque déploiement déclenche des évaluations automatisées de régression des prompts par rapport à un golden dataset avant mise en production.»**

#### 3. Socle technique transférable (5:30 – 7:30)

> **«Ce projet BaseSystem reflète ma maîtrise des briques clés requises pour ce poste :**
>
> **Côté RAG :** Je connais précisément les limites du RAG naïf (bruit dans le contexte, perte d'information au milieu du prompt) et comment les résoudre via le re-ranking et la recherche hybride dense/sparse.
>
> **Côté Agents :** Je maîtrise le tool-calling avec validation stricte via Zod / Structured Outputs pour éviter les erreurs de typage, la gestion des fenêtres de contexte et les flux décisionnels multi-étapes.
>
> **Côté Évaluation :** J'utilise LangSmith pour le tracing, le suivi de la latence par jeton et le coût, ainsi que la création de bancs de tests automatisés pour détecter les dérives de comportement des modèles.
>
> **En production :** Je traite les LLM comme n'importe quel service back-end — avec observabilité, monitoring de latence, et fallbacks. Je construis des evaluation pipelines qui bloquent le déploiement si la qualité des réponses déçoit.
>
> Ce sont exactement les briques citées dans votre fiche de poste — RAG pipeline design, agentic patterns, evaluation harnesses.»**

#### 4. Le volet SDK & Équipe Enablement (7:30 – 9:00)

> **«Au-delà de l'implémentation de cas d'usage, un aspect central de mon expérience — notamment lors de mes interventions en consulting pour des startups — est la conception de SDK internes et de bibliothèques de composants réutilisables en TypeScript.**
>
> **J'applique les principes SOLID pour abstraire la complexité des RAG et des agents dans des briques standardisées. Cela permet aux autres équipes de développement (back-end, front-end) d'intégrer des fonctionnalités IA de manière autonome, propre et sécurisée, sans avoir à réinventer la roue.**
>
> Un SDK bien conçu fait la différence entre une équipe qui sait faire de l'IA et une organisation qui scale l'IA :
> - Les développeurs intègrent des fonctionnalités AI en 5 lignes de code au lieu de 500
> - Les structures de prompt, les garde-fous et la télémétrie sont standardisés par défaut
> - Les équipes produit se concentrent sur l'expérience utilisateur, tandis que l'équipe AI garde le contrôle sur la performance et la gouvernance des modèles
>
> C'est un écho direct au travail sur la Shared Component Library et le SDK Salomon AI mentionné dans votre description de poste.»**

#### 5. Clôture & Motivation (9:00 – 10:00)

> **«Pour conclure, ce poste au sein de l'équipe Enablement de Salomon m'intéresse particulièrement parce qu'il combine deux éléments au cœur de mon expertise :**
>
> **1. D'un côté, la capacité technique à concevoir et livrer des cas d'usage LLM complexes en production — RAG, agents, évaluation, CI/CD.**
>
> **2. De l'autre, la posture de facilitateur : coder aux côtés des équipes produit, codifier les meilleurs patterns et transférer la compétence pour rendre l'organisation indépendante en IA d'ici 6 mois.**
>
> J'apporte l'exact stack technique que vous recherchez — TypeScript/Node.js expert, AWS Bedrock, Anthropic, LangSmith, patterns HITL — combiné avec un historique prouvé de transformation de capacités AI complexes en outils développeurs propres.
>
> Je serais ravi de mettre cette expertise au service de Salomon pour accélérer votre roadmap AI.
>
> **Je suis à votre disposition pour approfondir n'importe lequel de ces points. Merci.»**

---

### English Version — Full Script

Полный скрипт на английском — для использования, если интервью проходит на английском (рекомендуется, если ваш французский B1+ мешает точности технических терминов).

Как переключиться в начале звонка:

> **«Bonjour ! Merci pour votre temps aujourd'hui. Avant de commencer, comme le poste et la fiche technique sont en anglais, et que je suis C1 en anglais, est-ce que cela vous convient si nous réalisons la présentation et l'échange en anglais ? Cela me permettra d'être le plus précis possible sur les détails d'architecture.»**

#### Section 1: Hook (0:00–1:30)

> *«Hi everyone. I'm Mikita Kavaliou, a Senior Software Engineer specializing in LLM engineering and AI systems architecture. For the past two years, I've been focused on taking AI solutions into production — specifically RAG pipelines, agentic workflows, and evaluation frameworks.*
>
> *My primary stack is TypeScript and Node.js, combined with AWS Bedrock and native Anthropic APIs for Claude models. What defines my approach is applying strict software engineering principles — clean architecture, strong typing, and CI/CD automation — to generative AI to ensure reliability, performance, and maintainability.*
>
> *Rather than walking chronologically through my CV, I want to use these 10 minutes to show you how my production experience maps directly onto the Enablement mission at Salomon.»*

#### Section 2: BaseSystem Case (1:30–5:30)

> *«The project that best illustrates what I bring to Salomon is BaseSystem — an intelligent ticketing and customer operations engine built for the ski and mountain domain.*
>
> *I'd like to highlight four key technical pillars:*
>
> *1. Advanced Hybrid RAG Engine — deployed on AWS Bedrock using Claude 3.5 Sonnet. Hybrid search pipeline with domain-adapted chunking, paired with BGE and Cohere re-ranking. Filtered out irrelevant context before passing snippets into Claude.*
>
> *2. Agentic Patterns & Tool-Calling — decision-making agents using strict tool-calling. The agent dynamically queried RESTful business APIs to check real-time ticket availability and predictive discount codes.*
>
> *3. Human-In-The-Loop Workflow — for refunds, the LLM agent froze its session state and emitted an interactive payload to Slack using Block Kit. An operator reviewed and approved, then the agent resumed execution.*
>
> *4. CI/CD & Continuous Evaluation — automated regression testing in GitLab CI. Before any prompt or model update hit production, the pipeline ran evaluation runs using LangSmith against golden datasets.»*

#### Section 3: Transferable Foundation (5:30–7:30)

> *«The reason I highlight BaseSystem is that its underlying technical building blocks are 100% transferable to Salomon's retail and outdoor domain:*
>
> *First, RAG Pipeline Design — strong practical opinions on vector search, chunking, re-ranking.*
> *Second, Schema Safety with Zod — systematically enforce Zod schemas on structured outputs and function calling.*
> *Third, Evaluation on Unfamiliar Domains — built test datasets from scratch by collaborating with domain stakeholders.*
> *Fourth, Production Reliability — treat LLMs like any back-end service, with observability, latency monitoring, and fallbacks.»*

#### Section 4: SDK & Enablement (7:30–9:00)

> *«In my previous engagements, my role extended into building and publishing shared TypeScript SDKs. Rather than asking every product engineer to figure out Bedrock client setup, streaming interfaces, error handling, or telemetry wrappers, I encapsulated these best practices into reusable npm packages.*
>
> *When an Enablement engineer provides product teams with a clean, well-typed TypeScript SDK, developers can integrate AI features with 5 lines of code instead of 500, and prompt structures, safety guardrails, and cost-tracking telemetry are standardized out-of-the-box.»*

#### Section 5: Closing & Motivation (9:00–10:00)

> *«To conclude: I don't just want to build AI models in isolation. The core of an Enablement team is industrializing LLM patterns end-to-end AND empowering other engineers to build alongside you.*
>
> *I bring the exact technical stack you are looking for — expert TypeScript/Node.js, AWS Bedrock, Anthropic, LangSmith, HITL patterns — combined with a proven track record of packaging complex AI capabilities into clean developer tools.*
>
> *I would love to bring this expertise to Salomon to help accelerate your AI roadmap. Thank you, and I am ready for your questions!»*

---

## 2-Minute Elevator Pitch (Short Version)

Для первого контакта с рекрутером или краткого самопредставления:

> **Version française :**
> *«Je suis ingénieur logiciel avec plus de 5 ans d'expérience, spécialisé dans l'industrialisation d'applications basées sur les LLM dans l'écosystème TypeScript, Node.js et AWS Bedrock.*
>
> *Chez BaseSystem, j'ai conçu et mis en production des architectures RAG complexes et des systèmes multi-agents avec Claude 3.5 Sonnet, incluant du tool-calling pour la facturation et des systèmes Human-in-the-Loop via Slack.*
>
> *Ce qui m'intéresse dans le poste chez Salomon, c'est le positionnement Enablement. J'ai l'habitude de concevoir des composants réutilisables (SDK internes TypeScript) pour que d'autres développeurs intègrent l'IA sans repartir de zéro. C'est un rôle de facilitateur et d'architecte qui correspond exactement à ce que j'aime faire.»*

> **English version :**
> *«I'm a Senior Software Engineer with 5+ years of experience, specializing in production LLM systems in the TypeScript, Node.js, and AWS Bedrock ecosystem.*
>
> *At BaseSystem, I designed and deployed complex RAG architectures and multi-agent systems using Claude 3.5 Sonnet — including tool-calling for billing and Human-in-the-Loop via Slack.*
>
> *What attracts me to the Salomon role is the Enablement positioning. I regularly build reusable TypeScript SDKs so other developers can integrate AI without starting from scratch. That facilitator-and-architect role is exactly what I enjoy most.»*

---

## Questions d'entretien client (Client Interview Questions)

### Questions à poser au client en fin d'entretien

1. **Sur les premiers cas d'usage :**
   *« Quels sont les 1 ou 2 premiers cas d'usage sur lesquels l'équipe Enablement va démarrer ? »*

2. **Sur la répartition Platform / Enablement :**
   *« Comment se répartit concrètement le travail entre l'équipe Platform et l'équipe Enablement au quotidien ? »*

3. **Sur le niveau de maturité IA des équipes :**
   *« Quel est le niveau de maturité actuel des équipes produit/ingénierie sur l'IA — part-on de zéro ou y a-t-il déjà des initiatives en cours ? »*

4. **Sur l'infrastructure (si le sujet vient) :**
   *« Comment se passe l'interaction actuelle entre l'équipe Enablement et l'équipe Platform ? Est-ce que les choix d'infrastructure (par exemple, la base de données vectorielle) sont pris conjointement ? »*

5. **Sur le transfert de compétences :**
   *« L'un des objectifs à 6 mois est de rendre les équipes produit autonomes. Comment imaginez-vous le transfert de compétences ? Est-ce par du pair-programming, des ateliers techniques ou de la documentation ? »*

---

## Réponses aux questions comportementales (Behavioral Q&A)

### Q: « Pourquoi Salomon ? Qu'est-ce qui vous attire chez nous ? »

> **« Salomon est une marque emblématique qui fait face à des défis concrets d'ingénierie logicielle. Ce qui m'attire, c'est la maturité de la démarche : plutôt que de simplement faire des prototypes d'IA isolés, Salomon structure une vraie équipe IA dédiée (Platform + Enablement) pour standardiser ces pratiques à l'échelle de l'entreprise.**
>
> **Participer à la définition des standards techniques (le SDK Salomon AI) et aider les différentes équipes de dev à devenir autonomes en IA d'ici 6 mois est un défi d'ingénierie très stimulant. »**

### Q: « Comment gérez-vous la fiabilité des LLM en production ? »

> **« Pour garantir la fiabilité, je m'appuie sur trois piliers :**
>
> **1. La validation stricte des structures de données en entrée/sortie avec des outils comme Zod (Structured Outputs).**
>
> **2. L'évaluation continue : la mise en place de 'golden datasets' et de tests de non-régression automatisés directement dans les pipelines CI/CD (avec GitLab CI ou Jenkins) pour comparer les réponses à chaque modification de prompt.**
>
> **3. L'observabilité en production grâce à des outils comme LangSmith pour tracer les appels, mesurer la latence par jeton et détecter les dérives de comportement. »**

### Q: « Avez-vous de l'expérience dans le travail collaboratif avec des profils non-techniques ? »

> **« Oui, tout à fait. En tant que consultant pour des startups, j'ai régulièrement collaboré avec des Product Managers pour définir la viabilité d'un cas d'usage IA. Mon rôle est souvent d'expliquer de manière simple les limites des modèles (comme la gestion de la fenêtre de contexte ou les coûts d'API) afin de concevoir un produit réaliste et performant. Le dialogue constant est la clé du succès d'un projet IA. »**

### Q: « Vous avez surtout travaillé en petite équipe ou en indépendant — comment envisagez-vous l'intégration dans une équipe Enablement structurée ? »

> **« J'ai l'habitude de livrer des SDK et du code destiné à d'autres développeurs. Cela exige une grande rigueur de documentation, d'alignement sur des interfaces claires (APIs) et de communication.**
>
> **Travailler avec une équipe Platform qui fournit l'infra et un FDE qui gère la relation produit est un cadre idéal pour me concentrer sur la qualité des patterns et le transfert de compétences. En fin de mission, je fournis toujours des environnements techniques détaillés — c'est un réflexe de passation que j'ai solidement établi. »**

### Q: « Votre expérience RAG/agents est sur ski, fitness, langues — pas sur du retail/outdoor. Comment transposez-vous ? »

> **« Les mécaniques RAG, de tool-calling et d'évaluation sont agnostiques du domaine métier. Mon rôle est justement d'arriver sur un domaine méconnu, d'échanger avec les experts métier pour construire le 'golden dataset' et valider les réponses. Je l'ai déjà fait pour la réglementation juridique des stations de ski, et la démarche est identique pour le retail outdoor. »**

### Q: « Quelle serait votre recommandation pour le stockage vectoriel ? »

> **« En production, j'ai une très bonne expérience avec PostgreSQL + pgvector et l'index HNSW. C'est pragmatique, performant et évite d'ajouter un service tiers si PostgreSQL est déjà dans votre stack.**
>
> **Cela dit, si la volumétrie ou les besoins de filtrage dynamique l'exigent, des solutions dédiées comme Qdrant ou Pinecone sont très adaptées. Je resterai pragmatique selon vos contraintes d'infrastructure. »**

### Q: « Aucun outil d'IA n'était utilisé lors de votre mission Itransition (2021) — c'est voulu ? »

> **« 2021 était avant l'émergence des LLM en production. Cette expérience chez Itransition m'a permis de consolider mes fondamentaux en ingénierie logicielle back-end : conception d'API résilientes, sécurité, bases de données et typage strict.**
>
> **C'est précisément ce socle solide de développement traditionnel qui me permet aujourd'hui d'industrialiser l'IA proprement — sans ce background, les systèmes agents seraient fragiles et non-maintenables. »**

---

### Quick-Ref Sheet: Anticipated Objections & Perfect Answers

| Concern | Strategic Answer |
|---------|-----------------|
| **Small team / solo background** | *« I'm used to delivering SDKs for other developers — that requires documentation, clear APIs, communication. Working with Platform + FDE is ideal for me to focus on pattern quality and knowledge transfer. »* |
| **No retail/outdoor experience** | *« The mechanics (chunking, re-ranking, tool-calling, HITL) are domain-agnostic. I've already done this for ski regulations — unfamiliar domain → expert collaboration → golden dataset. »* |
| **Vector storage recommendation** | *« PostgreSQL + pgvector + HNSW in production. Pragmatic, performant, no extra service. Open to Qdrant/Pinecone if scale demands it. »* |
| **Why no AI in 2021?** | *« Pre-LLM era. That mission built my solid backend fundamentals — APIs, security, databases — which underpin everything I industrialize today. »* |

---

### Delivery Tips

1. **Темп речи:** ~130-140 слов в минуту (deliberate, спокойный ритм)
2. **Ключевые слова для акцента:** *Enablement, Shared Component Library, Human-in-the-Loop, Bedrock, Golden Datasets*
3. **Тон:** Pragmatic senior engineer — opinionated about best practices, но collaborative и product-minded
4. **Для Q&A держите в голове 3 конкретных примера:**
   - Почему PostgreSQL + pgvector + HNSW
   - Как строить eval для незнакомого домена
   - Как работаете с кросс-функциональными командами
5. **Если не уверены в французском:** переключитесь на английский через вежливый запрос в начале звонка

---

*Эта глава содержит полные скрипты презентации, собранные из материалов подготовки к Round 1 интервью Salomon. Все сценарии основаны на реальном опыте и фактических кейсах кандидата. Следующая глава — учебный план для подготовки к роли LLM Engineer.*
