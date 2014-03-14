# .bashrc

# Source global definitions
if [ -f /etc/bashrc ]; then
	. /etc/bashrc
fi

# User specific aliases and functions
#source /usr/share/git-core/contrib/completion/git-prompt.sh

export PS1='\u@\h \W$(__git_ps1 " (%s)") \$ '

PATH=$PATH:$HOME/.rvm/bin # Add RVM to PATH for scripting
[[ -s "$HOME/.rvm/scripts/rvm" ]] && . "$HOME/.rvm/scripts/rvm" # Load RVM function

export VAGRANT_DEFAULT_PROVIDER=libvirt

alias koji-katello='koji -c ~/.koji/katello-config'
alias koji-build='koji-katello build'
