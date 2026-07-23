[ INGESTION PIPELINE ]
  PDF/Docs ---> OCR/Parser ---> Semantic Chunking ---> Embedding Model ---> [ PostgreSQL + pgvector ] (HNSW)
                                                                                   ^
                                                                                   | (Metadata & Vectors)
                       [ RETRIEVAL PIPELINE ]                                      v
  User Query ---> Redis Semantic Cache? ---> Dense (Vector) + Sparse (BM25) ---> RRF ---> Re-ranker (Top-5) 
                       |                                                                   |
                       v (If cached)                                                       v
                 [ Fast Return ]                                                    [ Context Assembly ]
                                                                                           |
                       [ GENERATION & OBSERVABILITY ]                                      v
  User <--- Stream Output <--- Guardrails <--- Claude 3.5 Sonnet (Bedrock) <---------------+
                                    |
                                    v
                            [ LangSmith / OpenTelemetry ]