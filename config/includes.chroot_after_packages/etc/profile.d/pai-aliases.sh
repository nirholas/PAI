# PAI AI shortcuts
alias ask='ollama run'
alias models='ollama list'
alias pull='ollama pull'
alias chat='firefox-esr http://localhost:8080 &'

# Quick AI commands
pai-ask() {
    local model="${PAI_MODEL:-phi3:mini}"
    echo "$*" | ollama run "$model"
}

pai-code() {
    local model="${PAI_MODEL:-phi3:mini}"
    echo "Write code for: $*" | ollama run "$model"
}

pai-explain() {
    local model="${PAI_MODEL:-phi3:mini}"
    echo "Explain this simply: $*" | ollama run "$model"
}

export -f pai-ask pai-code pai-explain
