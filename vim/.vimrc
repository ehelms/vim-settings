set nocompatible               " no vi compatible mode
 
colorscheme vibrantink

autocmd BufWritePre  *.{js,rb,scss}  call StripTrailingWhite()
au BufRead,BufNewFile *.rabl setf ruby
au BufRead,BufNewFile *.rabl syn keyword rubyRabl node attribute object child collection attributes glue extends
au BufRead,BufNewFile *.rabl hi def link rubyRabl Function

function! StripTrailingWhite()
    let l:winview = winsaveview()
    silent! %s/\s\+$//
    call winrestview(l:winview)
endfunction

set tabpagemax=75


" Plug plugins
call plug#begin('~/.vim/plugged')

Plug 'leafgarland/typescript-vim'

call plug#end()
