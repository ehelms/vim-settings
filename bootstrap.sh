CURR_DIR=`pwd`

sudo yum install -y ruby-devel git screen vim postgresql-devel sqlite-devel libvirt-devel
sudo yum groupinstall -y "Development Tools"

rm ~/.bashrc
ln -s $CURR_DIR/.bashrc ~/.bashrc
ln -s $CURR_DIR/.rdebugrc ~/.rdebugrc
ln -s $CURR_DIR/screen/.screenrc ~/.screenrc
ln -s $CURR_DIR/vim/.vimrc ~/.vimrc
ln -s $CURR_DIR/vim/.vundle ~/.vundle
ln -s $CURR_DIR/vim ~/.vim
ln -s $CURR_DIR/.pryrc ~/.pryrc
ln -s $CURR_DIR/.git-prompt.sh ~/.git-prompt.sh

curl -fLo ~/.vim/autoload/plug.vim --create-dirs \
    https://raw.githubusercontent.com/junegunn/vim-plug/master/plug.vim

vim +PlugInstall +qall

git config --global user.name "Eric D. Helms"
git config --global user.email ericdhelms@gmail.com

source ~/.bashrc

gem install hub
