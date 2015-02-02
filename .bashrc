# .bashrc

# Source global definitions
if [ -f /etc/bashrc ]; then
	. /etc/bashrc
fi

source ./.git-prompt.sh

# User specific aliases and functions
if [ -f /usr/share/git-core/contrib/completion/git-prompt.sh ]; then
  source /usr/share/git-core/contrib/completion/git-prompt.sh
fi

YELLOW="\[\033[0;33m\]"
WHITE="\e[0;97m"

PS1="\u@\h \W$YELLOW\$(__git_ps1)\[$WHITE\]\$ "

PATH=$PATH:$HOME/.rvm/bin # Add RVM to PATH for scripting
[[ -s "$HOME/.rvm/scripts/rvm" ]] && . "$HOME/.rvm/scripts/rvm" # Load RVM function

export VAGRANT_DEFAULT_PROVIDER=libvirt

alias koji-katello='koji -c ~/.koji/katello-config'
alias koji-build='koji-katello build'
