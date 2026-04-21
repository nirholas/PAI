# PAI Developer Environment
if command -v code &>/dev/null; then
    export EDITOR="code --wait"
    export VISUAL="code --wait"
else
    export EDITOR="${EDITOR:-nano}"
    export VISUAL="${VISUAL:-nano}"
fi
export BROWSER="firefox-esr"

# Colored terminal
export TERM=xterm-256color
alias ls='ls --color=auto'
alias ll='ls -alF'
alias la='ls -A'
alias grep='grep --color=auto'

# Git shortcuts
alias gs='git status'
alias gc='git commit'
alias gp='git push'
alias gl='git log --oneline -20'
alias gd='git diff'

# Dev shortcuts
alias py='python3'
alias serve='python3 -m http.server'
alias ports='ss -tlnp'
