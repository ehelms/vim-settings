CURR_DIR=`pwd`

sudo yum install -y ruby-devel git screen vim
sudo yum groupinstall -y "Development Tools"
rm ~/.bashrc
ln -s $CURR_DIR/.bashrc ~/.bashrc
ln -s $CURR_DIR/.rdebugrc ~/.rdebugrc
ln -s $CURR_DIR/screen/.screenrc ~/.screenrc
ln -s $CURR_DIR/vim/.vimrc ~/.vimrc
ln -s $CURR_DIR/vim/.vundle ~/.vundle
ln -s $CURR_DIR/vim ~/.vim
vim +BundleInstall +qall
git config --global user.name "Eric D. Helms"
git config --global user.email ericdhelms@gmail.com
mkdir ~/workspace
\curl -L https://get.rvm.io | bash -s stable --ruby
source ~/.bashrc
