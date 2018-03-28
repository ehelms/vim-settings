set nocompatible               " no vi compatible mode

" colorscheme vibrantink
colorscheme badwolf

syntax enable

set tabstop=2
set softtabstop=2
set smarttab
set expandtab
set shiftwidth=2
set paste

highlight Normal ctermbg=none
highlight NonText ctermbg=none

" set cursorline
filetype indent on
set wildmenu
set lazyredraw
set showmatch

set incsearch
set hlsearch

autocmd BufWritePre  *  call StripTrailingWhite()
au BufRead,BufNewFile *.rabl setf ruby
au BufRead,BufNewFile Vagrantfile setf ruby
au BufRead,BufNewFile *.rabl syn keyword rubyRabl node attribute object child collection attributes glue extends
au BufRead,BufNewFile *.rabl hi def link rubyRabl Function
au BufNewFile,BufRead *.groovy  setf groovy
au BufNewFile,BufRead Jenkinsfile setf groovy
au BufRead,BufNewFile *.yml setf ansible
au BufRead,BufNewFile *.yaml setf ansible

function! StripTrailingWhite()
    let l:winview = winsaveview()
    silent! %s/\s\+$//
    call winrestview(l:winview)
endfunction

set tabpagemax=75

" Plug plugins
call plug#begin('~/.vim/plugged')

Plug 'leafgarland/typescript-vim'
Plug 'tfnico/vim-gradle'
Plug 'pearofducks/ansible-vim'

call plug#end()
