$branches = @(
    "feat/streaming-pdf-generation",
    "feat/document-risk-minimap",
    "feat/multiplayer-collaboration",
    "feat/document-entity-graph",
    "feat/dynamic-web-search",
    "feat/langgraph-orchestration",
    "feat/hybrid-search-retrieval"
)

foreach ($branch in $branches) {
    git checkout $branch
    git checkout main package.json package-lock.json
    git add package.json package-lock.json
    git commit -m "fix: resolve npm audit vulnerabilities"
    git push origin $branch
}

git checkout main
