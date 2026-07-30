#!/usr/bin/perl
use strict;
use warnings;
use Config;

exit 64 if @ARGV != 2;
exit 69 if $^O ne 'linux' || $Config{archname} !~ /^x86_64-linux/;

my ($left, $right) = @ARGV;
my $split_path = sub {
  my ($path) = @_;
  return if $path !~ m{\A(/(?:[A-Za-z0-9._\@-]+/)*)([A-Za-z0-9._\@-]+)\z};
  return if $2 eq '.' || $2 eq '..';
  return ($1, $2);
};
my ($left_parent, $left_name) = $split_path->($left);
my ($right_parent, $right_name) = $split_path->($right);
exit 64 if !defined($left_parent) || !defined($right_parent);
exit 64 if $left_parent ne $right_parent;
exit 64 if $left_name !~ /^\.baci-bootstrap-replacement-v2-[0-9a-f]{64}-[0-9a-f]{64}-[a-z0-9-]+$/;
exit 64 if $right_name =~ /^\.baci-bootstrap-replacement/;
exit 66 if !-f $left || -l $left || !-f $right || -l $right;

# Linux x86_64: renameat2(AT_FDCWD, left, AT_FDCWD, right, RENAME_EXCHANGE).
exit 70 if syscall(316, -100, $left, -100, $right, 2) != 0;
exit 0;
